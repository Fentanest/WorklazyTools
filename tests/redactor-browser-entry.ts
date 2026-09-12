import { prepareRedactorClient } from '../src/features/document-redactor/redactorClient.ts';
import { imageSize,pngPlan,crc32 } from '../src/features/document-redactor/input.ts';
const scope=window as unknown as {client:Awaited<ReturnType<typeof prepareRedactorClient>>;ready:boolean;fatal:string;helpers:unknown};
scope.helpers={imageSize,pngPlan,crc32};
prepareRedactorClient({diagnostics:true}).then(client=>{scope.client=client;(document.getElementById('input') as HTMLInputElement).disabled=false;scope.ready=true;}).catch(error=>{scope.fatal=String(error);});
