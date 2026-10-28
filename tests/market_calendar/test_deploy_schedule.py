"""Local workflow syntax and trigger guards; uses the installed PyYAML, never dispatches."""
from pathlib import Path
import unittest

import yaml


class DeployScheduleTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # BaseLoader keeps GitHub's `on` key as a string (YAML 1.1 treats it as a boolean).
        cls.workflow = yaml.load(Path('.github/workflows/deploy-site.yml').read_text(), Loader=yaml.BaseLoader)

    def condition(self, expression, event, mode='', gate='false', fresh='false'):
        values = {'github.event_name': event, 'inputs.mode': mode, 'vars.FOLIOTRACE_DEPLOY_V2': gate,
                  'steps.fresh.outputs.current': fresh}
        for name, value in values.items():
            expression = expression.replace(name, repr(value))
        # Only the workflow's small equality/and/or conditions are evaluated, without builtins.
        return eval(expression.replace('&&', ' and ').replace('||', ' or '), {'__builtins__': {}}, {})

    def test_daily_schedule_builds_default_main_and_uses_existing_pages_queue(self):
        workflow = self.workflow
        self.assertEqual(workflow['on']['schedule'], [{'cron': '0 22 * * *'}])
        self.assertEqual(workflow['on']['push']['branches'], ['main'])
        self.assertNotIn('pull_request', workflow['on'])
        self.assertEqual(workflow['concurrency'], {'group': 'pages', 'cancel-in-progress': 'false'})
        checkout = workflow['jobs']['build']['steps'][0]
        self.assertEqual(checkout['uses'], 'actions/checkout@v4')
        self.assertNotIn('ref', checkout['with'])  # Schedule event's SHA/ref are default main.
        self.assertIn('daily data refresh', workflow['run-name'])
        self.assertEqual(workflow['jobs']['deploy']['needs'], 'build')

    def test_automatic_runs_respect_gate_and_dispatch_modes_are_preserved(self):
        jobs = self.workflow['jobs']
        for event, mode, gate, expected in (
                ('schedule', '', 'true', (True, True)), ('schedule', '', 'false', (False, False)),
                ('push', '', 'true', (True, True)), ('push', '', 'false', (False, False)),
                ('workflow_dispatch', 'validate', 'false', (True, False)),
                ('workflow_dispatch', 'deploy', 'false', (True, True))):
            with self.subTest(event=event, mode=mode, gate=gate):
                build = self.condition(jobs['build']['if'], event, mode, gate)
                deploy = build and self.condition(jobs['deploy']['if'], event, mode, gate)
                self.assertEqual((build, deploy), expected)

    def test_schedule_keeps_latest_main_guard_and_published_calendar_input(self):
        steps = self.workflow['jobs']['deploy']['steps']
        guard = next(step for step in steps if step.get('id') == 'fresh')
        self.assertEqual(guard['env']['EXPECTED_SOURCE'], '${{ github.sha }}')
        self.assertIn('refs/heads/main', guard['run'])
        deploy = next(step for step in steps if step.get('id') == 'deployment')
        self.assertFalse(self.condition(deploy['if'], 'schedule', fresh='false'))
        self.assertTrue(self.condition(deploy['if'], 'schedule', fresh='true'))
        self.assertTrue(self.condition(deploy['if'], 'workflow_dispatch', fresh='false'))
        calendar = next(step for step in self.workflow['jobs']['build']['steps']
                        if step.get('id') == 'market-calendar')
        self.assertEqual(calendar['with']['ref'], 'market-calendar-data')


if __name__ == '__main__':
    unittest.main(verbosity=2)
