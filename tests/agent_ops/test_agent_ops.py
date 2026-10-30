from __future__ import annotations
import copy
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
# When installed: repo/tests/agent_ops/test_agent_ops.py -> repo/scripts.
SCRIPTS = ROOT / 'scripts'
sys.path.insert(0, str(SCRIPTS))
from secret_scan import SensitiveContentError, reject_secrets
import agent_ops as ops
import codex_direct as cd
import gemini_research as gr


class SecretScanTests(unittest.TestCase):
    def test_private_key_blocked(self):
        with self.assertRaises(SensitiveContentError):reject_secrets('-----BEGIN PRIVATE KEY----- abc')
    def test_token_shapes_blocked(self):
        for text in ('ghp_'+'a'*30,'AKIA'+'A'*16,'Authorization: Bearer abcdefghijklmnop','password="abcdefghijklmnop1234"'):
            with self.assertRaises(SensitiveContentError):reject_secrets(text)
    def test_error_does_not_echo_value(self):
        with self.assertRaises(SensitiveContentError) as ex:reject_secrets('ghp_'+'z'*30)
        self.assertNotIn('zzzz',str(ex.exception))
    def test_plain_text_allowed(self):
        reject_secrets('Return 2 from search.')
    def test_no_model_client_left(self):
        self.assertFalse((SCRIPTS/'jev_client.py').exists())
        for name in ('agent_ops.py','gemini_research.py','codex_direct.py'):
            self.assertNotIn('jev',(SCRIPTS/name).read_text().lower())


class RepoFixture(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)/'repo';self.root.mkdir()
        self.git('init','-q');self.git('config','user.email','fixture@example.invalid');self.git('config','user.name','Fixture')
        (self.root/'docs').mkdir();(self.root/'src').mkdir()
        self.config={'schema_version':1,'project':'Fixture','models':{'gemini':'gemini-4-argon-high','implementation':'gpt-6-sol','review':'gpt-6-astra','research':'gpt-6.1-luna'},'review':{'max_tasks':5,'max_lines':800},'line_count_exclude_globs':['vendor/**'],'high_risk_paths':[{'glob':'src/orders.py','reason':'order_safety'}]}
        self.write_config()
        (self.root/'src/search.py').write_text('def search():\n    return 1\n')
        (self.root/'plan.md').write_text('# Approved plan\nReturn 2 from search.\n')
        (self.root/'.gitignore').write_text('docs/jobs/todo/\n__pycache__/\n')
        self.git('add','.');self.git('commit','-qm','base');self.base=self.git('rev-parse','HEAD')
        self.task={'schema_version':1,'task_id':'T1','batch_id':'B1','area':'search','request_mode':'plan-and-implement','implementation_authorized':True,'base_commit':self.base,
            'approved_plan':{'path':'plan.md','sha256':cd.digest((self.root/'plan.md').read_bytes()),'start_line':1,'end_line':2},
            'requirements':[{'id':'R1','text':'Return 2 from search.','evidence':[{'path':'src/search.py','start_line':1,'end_line':2}]}],
            'tests':[],'no_tests_reason':'Synthetic protocol fixture; the real tests are this suite.'}
        (self.root/'src/search.py').write_text('def search():\n    return 2\n')
    def tearDown(self):self.temp.cleanup()
    def git(self,*args):
        p=subprocess.run(['git',*args],cwd=self.root,text=True,capture_output=True,check=True);return p.stdout.strip()
    def write_config(self):(self.root/'docs/agent-ops-config.json').write_text(json.dumps(self.config))


class EvidenceAndQueueTests(RepoFixture):
    def test_pinned_evidence_accumulates(self):
        r=ops.check_task(self.root,self.task);self.assertEqual(r['action'],'continue_accumulating')
        self.assertEqual(r['status'],'implementation_done_review_pending');self.assertTrue(r['not_a_formal_review'])
    def test_requirement_never_marked_supported(self):
        r=ops.check_task(self.root,self.task)
        self.assertEqual([a['verdict'] for a in r['requirements']],['not_assessed'])
        self.assertEqual(r['requirements'][0]['evidence'][0]['path'],'src/search.py')
    def test_repeated_check_deduplicates(self):
        ops.check_task(self.root,self.task)
        r=ops.check_task(self.root,self.task);self.assertTrue(r['deduplicated'])
    def test_changed_bytes_recheck(self):
        ops.check_task(self.root,self.task)
        (self.root/'src/search.py').write_text('def search():\n    return 3\n')
        r=ops.check_task(self.root,self.task);self.assertNotIn('deduplicated',r)
    def test_commit_same_bytes_does_not_invalidate(self):
        ops.check_task(self.root,self.task)
        self.git('add','src/search.py');self.git('commit','-qm','preserve')
        r=ops.check_task(self.root,self.task);self.assertTrue(r['deduplicated'])
    def test_plan_hash_mutation_blocks(self):
        (self.root/'plan.md').write_text('Changed approval\nReturn 1\n')
        with self.assertRaisesRegex(ops.OpsError,'APPROVED_PLAN_CHANGED'):ops.check_task(self.root,self.task)
    def test_requirement_weaken_in_place_blocks(self):
        ops.check_task(self.root,self.task);task=copy.deepcopy(self.task);task['requirements'][0]['text']='Anything is fine'
        with self.assertRaisesRegex(ops.OpsError,'CONTRACT_CHANGED'):ops.check_task(self.root,task)
    def test_plan_only_no_implementation_record(self):
        self.task['request_mode']='plan-only'
        with self.assertRaisesRegex(ops.OpsError,'plan-only'):ops.check_task(self.root,self.task)
    def test_hard_risk_path_flags_review(self):
        (self.root/'src/orders.py').write_text('order=1\n')
        r=ops.check_task(self.root,self.task);self.assertIn('order_safety',r['review_reasons'])
    def test_five_tasks_not_five_commits(self):
        for i in range(5):
            task=copy.deepcopy(self.task);task['task_id']=f'T{i}'
            r=ops.check_task(self.root,task)
        self.assertEqual(r['action'],'review_required');self.assertEqual(r['pending_tasks'],5)
    def test_line_count_triggers(self):
        (self.root/'src/search.py').write_text('def search():\n    return 2\n'+'# explanation\n'*801)
        r=ops.check_task(self.root,self.task);self.assertIn('line_limit',r['review_reasons'])
    def test_vendor_count_exclusion_not_risk_waiver(self):
        (self.root/'vendor').mkdir();(self.root/'vendor/x.js').write_text('x\n'*900)
        n,excluded=ops.substantive_lines(self.root,self.base,self.config)
        self.assertLess(n,800);self.assertIn('vendor/x.js',excluded)
    def test_final_boundary_always_review(self):
        ops.check_task(self.root,self.task)
        self.assertEqual(ops.boundary(self.root,'B1','final')['action'],'review_required')
    def test_announced_area_change_closes_batch(self):
        ops.check_task(self.root,self.task)
        r=ops.boundary(self.root,'B1','area','another feature');self.assertEqual(r['action'],'review_required')
    def test_area_change_needs_description(self):
        ops.check_task(self.root,self.task)
        with self.assertRaisesRegex(ops.OpsError,'NEXT_AREA_DESCRIPTION'):ops.boundary(self.root,'B1','area','  ')
    def test_env_file_never_read(self):
        (self.root/'.env').write_text('danger')
        with self.assertRaisesRegex(ops.OpsError,'SENSITIVE_PATH'):ops.read_source(self.root,'.env')
    def test_operational_data_never_read(self):
        with self.assertRaisesRegex(ops.OpsError,'SENSITIVE_PATH'):ops.read_source(self.root,'data/users.json')
    def test_path_traversal(self):
        with self.assertRaises(ops.OpsError):ops.source_path(self.root,'../secret')
    def test_symlink_escape(self):
        (self.root/'src/link').symlink_to('/etc/passwd')
        with self.assertRaisesRegex(ops.OpsError,'SYMLINK'):ops.read_source(self.root,'src/link')
    def test_invalid_line_range(self):
        with self.assertRaisesRegex(ops.OpsError,'RANGE'):ops.excerpt(self.root,{'path':'src/search.py','start_line':1,'end_line':99})
    def test_duplicate_requirement(self):
        self.task['requirements'].append(copy.deepcopy(self.task['requirements'][0]))
        with self.assertRaisesRegex(ops.OpsError,'DUPLICATE'):ops.validate_task(self.root,self.task)
    def test_reserved_question_id(self):
        self.task['requirements'][0]['id']='impact'
        with self.assertRaisesRegex(ops.OpsError,'RESERVED'):ops.validate_task(self.root,self.task)
    def test_gemini_model_not_pinned(self):
        for value in ('gemini-4-argon-high',None):
            self.config['models']['gemini']=value;self.write_config();ops.load_config(self.root)
        self.config['models']['gemini']='';self.write_config()
        with self.assertRaisesRegex(ops.OpsError,'INVALID_GEMINI_MODEL'):ops.load_config(self.root)
    def test_missing_required_test_requests_repair(self):
        self.task['tests']=[{'id':'u1','input_paths':['src/search.py']}]
        r=ops.check_task(self.root,self.task)
        self.assertEqual(r['action'],'repair_or_run_required_tests')
    def test_actual_test_receipt(self):
        self.task['tests']=[{'id':'u1','input_paths':['src/search.py']}]
        receipt=ops.run_test(self.root,self.task,'u1',[sys.executable,'-c','print("Ran 2 tests")'],'unit',10)
        self.assertTrue(receipt['passed']);self.assertEqual(receipt['selected_count'],2)
        self.assertEqual(ops.valid_tests(self.root,self.task)[1],[])
    def test_zero_test_not_pass(self):
        self.task['tests']=[{'id':'u1','input_paths':['src/search.py']}]
        receipt=ops.run_test(self.root,self.task,'u1',[sys.executable,'-c','print("Ran 0 tests")'],'unit',10)
        self.assertFalse(receipt['passed'])
    def test_stale_test_invalidated(self):
        self.task['tests']=[{'id':'u1','input_paths':['src/search.py']}]
        ops.run_test(self.root,self.task,'u1',[sys.executable,'-c','print("Ran 2 tests")'],'unit',10)
        (self.root/'src/search.py').write_text('def search():\n    return 3\n')
        self.assertEqual(ops.valid_tests(self.root,self.task)[1],['u1'])
    def test_missing_test_log_invalidated(self):
        self.task['tests']=[{'id':'u1','input_paths':['src/search.py']}]
        r=ops.run_test(self.root,self.task,'u1',[sys.executable,'-c','print("Ran 2 tests")'],'unit',10)
        Path(r['log_path']).unlink();self.assertEqual(ops.valid_tests(self.root,self.task)[1],['u1'])
    def test_state_outside_tracked_source(self):
        ops.check_task(self.root,self.task)
        self.assertTrue((cd.state_home(self.root)/'reviews.json').is_file())
        self.assertNotIn('agent-ops',self.git('status','--porcelain'))
    def test_review_requires_separate_worktree(self):
        ops.check_task(self.root,self.task);ops.boundary(self.root,'B1','final')
        with self.assertRaisesRegex(ops.OpsError,'SEPARATE'):ops.dispatch_review(self.root,'B1',str(self.root))


class DispatchContractTests(RepoFixture):
    def request(self):
        p=self.root/'instruction.txt';p.write_text('Do not run `echo HACK`; $() is source text.')
        return {'task_id':'new-task','role':'review','execution':'research','workspace':str(self.root),
                'prompt_file':str(p),'approval_reference':'approved plan review','request_mode':'plan-only','implementation_authorized':False}
    def test_implementation_needs_authorization(self):
        r=self.request();r.update(role='implementation',execution='implementation')
        with self.assertRaisesRegex(cd.DispatchError,'NOT_AUTHORIZED'):cd.dispatch(self.root,r,self.config)
    def test_luna_fallback_needs_quota(self):
        r=self.request();r['role']='research'
        with self.assertRaisesRegex(cd.DispatchError,'QUOTA'):cd.dispatch(self.root,r,self.config)
    def test_luna_fallback_needs_evidence(self):
        r=self.request();r.update(role='research',fallback_reason='gemini_quota_exceeded')
        with self.assertRaisesRegex(cd.DispatchError,'EVIDENCE'):cd.dispatch(self.root,r,self.config)
    def test_execution_not_model_identity(self):
        r=self.request();r['execution']='implementation'
        with self.assertRaisesRegex(cd.DispatchError,'ROLE_MISMATCH'):cd.dispatch(self.root,r,self.config)
    def test_native_request_metadata(self):
        record={'request':{'model':'gpt-6-astra','cwd':'/work'},'workspaceRoot':'/work','write':True,'threadId':'abcd-12345678','sessionId':'not-codex'}
        self.assertEqual(cd.requested_fields(record),('gpt-6-astra','/work',True,'abcd-12345678'))
    def test_model_mismatch_immediate(self):
        rec={'request':{'model':'wrong'},'workspaceRoot':str(self.root),'write':False}
        with patch.object(cd,'job_data',return_value=rec):
            with self.assertRaisesRegex(cd.DispatchError,'MODEL_MISMATCH'):cd.verify_job(Path('/plugin'),self.root,'task-1','gpt-6-astra',False,{},timeout=0)
    def test_cwd_mismatch_immediate(self):
        rec={'request':{'model':'gpt-6-astra'},'workspaceRoot':'/wrong','write':False}
        with patch.object(cd,'job_data',return_value=rec):
            with self.assertRaisesRegex(cd.DispatchError,'CWD_MISMATCH'):cd.verify_job(Path('/plugin'),self.root,'task-1','gpt-6-astra',False,{},timeout=0)
    def test_write_mismatch_immediate(self):
        rec={'request':{'model':'gpt-6-astra'},'workspaceRoot':str(self.root),'write':False}
        with patch.object(cd,'job_data',return_value=rec):
            with self.assertRaisesRegex(cd.DispatchError,'WRITE_MISMATCH'):cd.verify_job(Path('/plugin'),self.root,'task-1','gpt-6-astra',True,{},timeout=0)
    def test_actual_model_checked_not_only_requested(self):
        rec={'request':{'model':'gpt-6-astra'},'workspaceRoot':str(self.root),'write':False,'threadId':'abcdef-1234'}
        with patch.object(cd,'job_data',return_value=rec),patch.object(cd,'observed_turn',return_value={'model':'wrong','cwd':str(self.root),'sandbox_policy':{'type':'read-only'}}):
            with self.assertRaisesRegex(cd.DispatchError,'ACTUAL_SESSION_MODEL'):cd.verify_job(Path('/plugin'),self.root,'task-1','gpt-6-astra',False,{},timeout=0)
    def test_unverified_actual_session_not_passed(self):
        rec={'request':{'model':'gpt-6-astra'},'workspaceRoot':str(self.root),'write':False}
        with patch.object(cd,'job_data',return_value=rec):
            with self.assertRaisesRegex(cd.DispatchError,'UNVERIFIED'):cd.verify_job(Path('/plugin'),self.root,'task-1','gpt-6-astra',False,{},timeout=0)
    def test_danger_full_access_not_accepted(self):
        rec={'request':{'model':'gpt-6-astra'},'workspaceRoot':str(self.root),'write':True,'threadId':'abcdef-1234'}
        with patch.object(cd,'job_data',return_value=rec),patch.object(cd,'observed_turn',return_value={'model':'gpt-6-astra','cwd':str(self.root),'sandbox_policy':{'type':'danger-full-access'}}):
            with self.assertRaisesRegex(cd.DispatchError,'SANDBOX'):cd.verify_job(Path('/plugin'),self.root,'task-1','gpt-6-astra',True,{},timeout=0)
    def test_gemini_model_optional(self):
        cmd=gr.build_argv(self.root,'abc',90,Path('/log'))
        self.assertNotIn('--model',cmd);self.assertNotIn('--mode',cmd);self.assertNotIn('--effort',cmd)
        cmd=gr.build_argv(self.root,'abc',90,Path('/log'),'gemini-4-argon-high')
        self.assertEqual(cmd[cmd.index('--model')+1],'gemini-4-argon-high')
    def test_gemini_runs_memory_capped(self):
        cmd=gr.build_argv(self.root,'abc',90,Path('/log'))
        self.assertEqual(cmd[:3],['systemd-run','--user','--scope']);self.assertIn('MemoryMax=8G',cmd)
        self.assertLess(cmd.index('MemoryMax=8G'),cmd.index('agy'))
    def test_gemini_shell_allowed(self):
        self.assertIn('셸·git 읽기·검색',gr.HEADER);self.assertIn('운영',gr.HEADER)
    def test_config_has_no_model_api_section(self):
        self.assertNotIn('jev',(self.root/'docs/agent-ops-config.json').read_text())
    def test_unknown_plugin_does_not_guess(self):
        with self.assertRaisesRegex(cd.DispatchError,'PLUGIN_ROOT_NOT_UNIQUE'):cd.find_plugin(str(self.root/'missing'))
    def test_finished_report_does_not_authorize_deployment(self):
        # Exercise finish on a fixed candidate and a valid report, without a paid runtime.
        ops.check_task(self.root,self.task);ops.boundary(self.root,'B1','final')
        self.git('add','.');self.git('commit','-qm','candidate');candidate=self.git('rev-parse','HEAD')
        review=Path(self.temp.name)/'review';self.git('worktree','add','--detach',str(review),candidate)
        fake={'status':'running','job_id':'task-fixture-1','key':'dispatch-key'}
        with patch.object(ops,'dispatch',return_value=fake):
            rec=ops.dispatch_review(self.root,'B1',str(review))
        report={'schema_version':1,'review_key':rec['key'],'candidate_commit':candidate,'target_digest':rec['target_digest'],'verdict':'passed','findings':[],'evidence':[{'path':'src/search.py','reason':'fixture review'}],'missing_required':[]}
        cd.atomic_json(Path(rec['report_path']),report)
        with patch.object(ops,'inspect_job',return_value={'execution_terminal':True,'native_status':'completed'}):
            r=ops.finish_review(self.root,'B1','task-fixture-1')
        self.assertFalse(r['deployment_authorized']);self.assertEqual(r['final_claude_approval'],'still_required')
        self.assertEqual(r['remaining_tasks'],0)
    def test_failed_runtime_cannot_apply_pass_report(self):
        with patch.object(ops,'inspect_job',return_value={'execution_terminal':True,'native_status':'failed'}):
            with self.assertRaisesRegex(ops.OpsError,'DID_NOT_COMPLETE'):ops.finish_review(self.root,'B1','task-test-1')



class RealSubprocessDispatchTests(RepoFixture):
    """Runs a local fake companion through Node; no Codex model is invoked."""
    def setUp(self):
        super().setUp()
        if not shutil.which('node'): self.skipTest('node is needed only for the fake-plugin integration test')
        self.plugin=Path(self.temp.name)/'plugin'
        (self.plugin/'scripts/lib').mkdir(parents=True);(self.plugin/'agents').mkdir()
        (self.plugin/'agents/codex-rescue.md').write_text('Forward to codex-companion. --model --write --fresh --background')
        (self.plugin/'scripts/lib/state.mjs').write_text('''import path from 'node:path';import crypto from 'node:crypto';
export function resolveJobsDir(cwd){return path.join(process.env.CLAUDE_PLUGIN_DATA,crypto.createHash('sha256').update(cwd).digest('hex'), 'jobs');}''')
        (self.plugin/'scripts/codex-companion.mjs').write_text('''// Supports --model --write --fresh --background --prompt-file --cwd --json
import fs from 'node:fs';import path from 'node:path';import {resolveJobsDir} from './lib/state.mjs';
const a=process.argv.slice(2),op=a[0];function opt(n){return a[a.indexOf(n)+1]};
const cwd=opt('--cwd'),dir=resolveJobsDir(cwd);fs.mkdirSync(dir,{recursive:true});
const jid='task-fixture123',file=path.join(dir,jid+'.json');
if(op==='task'){
 const model=opt('--model'),write=a.includes('--write'),thread='11111111-2222-3333-4444-555555555555';
 const r={id:jid,request:{model,cwd,write},workspaceRoot:cwd,write,threadId:thread,status:'running'};
 fs.writeFileSync(file,JSON.stringify(r));
 const session=path.join(process.env.CODEX_HOME,'sessions','2026','09','22');fs.mkdirSync(session,{recursive:true});
 fs.writeFileSync(path.join(session,'rollout-'+thread+'.jsonl'),JSON.stringify({type:'turn_context',payload:{model:process.env.FAKE_ACTUAL_MODEL||model,cwd,sandbox_policy:{type:write?'workspace-write':'read-only',writable_roots:write?[cwd]:[]}}})+'\\n');
 const prompt=fs.readFileSync(opt('--prompt-file'),'utf8');fs.writeFileSync(path.join(dir,'received-prompt.txt'),prompt);
 console.log(JSON.stringify({jobId:jid,status:'queued'}));
}else if(op==='cancel'){const r=JSON.parse(fs.readFileSync(file));r.status='cancelled';fs.writeFileSync(file,JSON.stringify(r));console.log(JSON.stringify({jobId:jid,status:'cancelled'}));}
else{console.log(fs.readFileSync(file,'utf8'));}
''')
        self.fakeenv=patch.dict(os.environ,{'CLAUDE_PLUGIN_DATA':str(Path(self.temp.name)/'plugin-state'),'CODEX_HOME':str(Path(self.temp.name)/'codex-home')},clear=False);self.fakeenv.start()
    def tearDown(self):
        if hasattr(self,'fakeenv'):self.fakeenv.stop()
        super().tearDown()
    def req(self,role='review',execution='research',workspace=None):
        workspace=workspace or self.root
        p=workspace/'docs/jobs/todo/prompt.txt';p.parent.mkdir(parents=True,exist_ok=True)
        p.write_text('Literal text: `touch HACKED` and $(touch HACKED2), not shell code.\n')
        return {'task_id':'job-1','role':role,'execution':execution,'workspace':str(workspace),'prompt_file':str(p),
            'approval_reference':'fixture approved scope','request_mode':'plan-and-implement','implementation_authorized':role=='implementation'}
    def test_actual_node_argv_model_cwd_and_shell_literal(self):
        r=cd.dispatch(self.root,self.req(),self.config,str(self.plugin))
        self.assertTrue(r['verified']);self.assertEqual(r['model'],'gpt-6-astra');self.assertFalse(r['write'])
        self.assertEqual(r['workspace'],str(self.root));self.assertFalse((self.root/'HACKED').exists());self.assertFalse((self.root/'HACKED2').exists())
    def test_same_launch_cannot_duplicate(self):
        request=self.req();a=cd.dispatch(self.root,request,self.config,str(self.plugin));b=cd.dispatch(self.root,request,self.config,str(self.plugin))
        self.assertEqual(a['job_id'],b['job_id']);self.assertTrue(b['deduplicated'])
    def test_actual_model_mismatch_cancelled(self):
        with patch.dict(os.environ,{'FAKE_ACTUAL_MODEL':'wrong-model'}):
            r=cd.dispatch(self.root,self.req(),self.config,str(self.plugin))
        self.assertEqual(r['status'],'cancel_requested');self.assertIn('ACTUAL_SESSION_MODEL',r['error'])
        native=cd.job_data(self.plugin,self.root,r['job_id'],dict(os.environ));self.assertEqual(native['status'],'cancelled')
    def test_implementation_really_uses_its_worktree(self):
        work=Path(self.temp.name)/'implementation';self.git('worktree','add','-b','impl',str(work),self.base)
        request=self.req('implementation','implementation',work)
        r=cd.dispatch(self.root,request,self.config,str(self.plugin))
        self.assertTrue(r['write']);self.assertEqual(r['model'],'gpt-6-sol');self.assertEqual(r['workspace'],str(work))
    def test_codex_implementation_uses_codex_fallback_not_muse(self):
        self.config['models'].update(implementation='muse-spark-1.3-contributor',implementation_fallback='gpt-6-sol')
        work=Path(self.temp.name)/'implementation2';self.git('worktree','add','-b','impl2',str(work),self.base)
        r=cd.dispatch(self.root,self.req('implementation','implementation',work),self.config,str(self.plugin))
        self.assertEqual(r['model'],'gpt-6-sol')
    def test_failed_or_missing_plugin_no_fake_success(self):
        with self.assertRaises(cd.DispatchError):cd.dispatch(self.root,self.req(),self.config,str(self.plugin/'missing'))


class ReviewLifecycleTests(RepoFixture):
    def setup_review(self):
        ops.check_task(self.root,self.task);ops.boundary(self.root,'B1','final')
        self.git('add','.');self.git('commit','-qm','candidate');candidate=self.git('rev-parse','HEAD')
        review=Path(self.temp.name)/'review';self.git('worktree','add','--detach',str(review),candidate)
        with patch.object(ops,'dispatch',return_value={'status':'running','job_id':'task-lifecycle-1','key':'fake-dispatch'}):
            rec=ops.dispatch_review(self.root,'B1',str(review))
        report={'schema_version':1,'review_key':rec['key'],'candidate_commit':candidate,'target_digest':rec['target_digest'],'verdict':'passed','findings':[],'evidence':[{'path':'src/search.py','note':'fixture'}],'missing_required':[]}
        cd.atomic_json(Path(rec['report_path']),report)
        return review,rec,report
    def test_duplicate_review_does_not_call_dispatch(self):
        review,rec,_=self.setup_review()
        with patch.object(ops,'dispatch') as call:
            new=ops.dispatch_review(self.root,'B1',str(review))
        self.assertTrue(new['deduplicated']);call.assert_not_called()
    def test_new_task_during_old_review_stays_pending(self):
        _,rec,_=self.setup_review()
        t2=copy.deepcopy(self.task);t2['task_id']='T2'
        ops.check_task(self.root,t2)
        with patch.object(ops,'inspect_job',return_value={'execution_terminal':True,'native_status':'completed'}):
            result=ops.finish_review(self.root,'B1','task-lifecycle-1')
        self.assertEqual(result['remaining_tasks'],1)
        self.assertEqual(ops.summary_status(self.root)['batches']['B1']['pending_tasks'],['T2'])
    def test_review_source_mutation_blocks(self):
        review,rec,_=self.setup_review();(review/'src/search.py').write_text('def search():\n    return 99\n')
        with patch.object(ops,'inspect_job',return_value={'execution_terminal':True,'native_status':'completed'}):
            with self.assertRaisesRegex(ops.OpsError,'SOURCE_MUTATED'):ops.finish_review(self.root,'B1','task-lifecycle-1')
    def test_false_pass_missing_required_rejected(self):
        _,rec,report=self.setup_review();report['missing_required']=['unit evidence'];cd.atomic_json(Path(rec['report_path']),report)
        with patch.object(ops,'inspect_job',return_value={'execution_terminal':True,'native_status':'completed'}):
            with self.assertRaisesRegex(ops.OpsError,'INVALID_PASS'):ops.finish_review(self.root,'B1','task-lifecycle-1')
    def test_wrong_candidate_report_rejected(self):
        _,rec,report=self.setup_review();report['candidate_commit']='bad';cd.atomic_json(Path(rec['report_path']),report)
        with patch.object(ops,'inspect_job',return_value={'execution_terminal':True,'native_status':'completed'}):
            with self.assertRaisesRegex(ops.OpsError,'TARGET_MISMATCH'):ops.finish_review(self.root,'B1','task-lifecycle-1')
    def test_dirty_candidate_not_auto_reset(self):
        ops.check_task(self.root,self.task);ops.boundary(self.root,'B1','final')
        review=Path(self.temp.name)/'review';self.git('worktree','add','--detach',str(review),self.base)
        with self.assertRaisesRegex(ops.OpsError,'COMMITTED_CANDIDATE'):ops.dispatch_review(self.root,'B1',str(review))
        self.assertIn('return 2',(self.root/'src/search.py').read_text())

class PolicyRegressionTests(RepoFixture):
    def test_cached_assessment_still_honors_new_final_boundary(self):
        ops.check_task(self.root,self.task)
        ops.boundary(self.root,'B1','final')
        r=ops.check_task(self.root,self.task)
        self.assertEqual(r['action'],'review_required');self.assertTrue(r['deduplicated'])
    def test_test_kind_cannot_be_switched_to_bypass_zero_count(self):
        self.task['tests']=[{'id':'u1','input_paths':['src/search.py'],'kind':'unit'}]
        with self.assertRaisesRegex(ops.OpsError,'TEST_KIND_CONFLICT'):
            ops.run_test(self.root,self.task,'u1',[sys.executable,'-c','print("Ran 0 tests")'],'static',10)
    def test_environment_change_invalidates_receipt(self):
        self.task['tests']=[{'id':'u1','input_paths':['src/search.py']}]
        with patch.dict(os.environ,{'TZ':'UTC'}):
            ops.run_test(self.root,self.task,'u1',[sys.executable,'-c','print("Ran 2 tests")'],'unit',10)
        with patch.dict(os.environ,{'TZ':'Asia/Seoul'}):
            self.assertEqual(ops.valid_tests(self.root,self.task)[1],['u1'])
    def test_rust_multiple_binaries_do_not_look_like_zero_tests(self):
        text='test result: ok. 14 passed; 0 failed; 1 ignored;\ntest result: ok. 0 passed; 0 failed; 0 ignored;'
        self.assertEqual(ops.test_count(text,['cargo','test']),14)
    def test_snapshot_change_during_assessment_is_unverified(self):
        original=ops.excerpt
        def mutating(root,spec):
            res=original(root,spec)
            if spec['path']=='src/search.py':  # evidence read, after the source snapshot
                (self.root/'src/search.py').write_text('def search():\n    return 4\n')
            return res
        with patch.object(ops,'excerpt',side_effect=mutating):
            r=ops.check_task(self.root,self.task)
        self.assertIn('source_changed_during_assessment',r['errors']);self.assertEqual(r['action'],'collect_evidence')

if __name__ == '__main__':
    unittest.main()
