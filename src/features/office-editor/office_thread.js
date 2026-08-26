// SPDX-License-Identifier: MIT
'use strict';

let zetajs;
let css;
let desktop;
let documentModel;

function startOffice() {
  const context = zetajs.getUnoComponentContext();
  desktop = css.frame.Desktop.create(context);
  zetajs.mainPort.onmessage = function (event) {
    if (event.data.cmd === 'open') {
      openFile(event.data.filename);
      return;
    }
    if (event.data.cmd === 'save') {
      try {
        if (!documentModel) throw new Error('no-document');
        documentModel.store();
        zetajs.mainPort.postMessage({ cmd: 'saved' });
      } catch {
        zetajs.mainPort.postMessage({ cmd: 'save-failed' });
      }
      return;
    }
    if (event.data.cmd === 'convert-xls') {
      convertSpreadsheet(event.data.filename, event.data.output);
    }
  };
  zetajs.mainPort.postMessage({ cmd: 'ready' });
}

function convertSpreadsheet(filename, output) {
  let sourceModel;
  try {
    const openProperties = [
      new css.beans.PropertyValue({ Name: 'MacroExecutionMode', Value: 0 }),
      new css.beans.PropertyValue({ Name: 'UpdateDocMode', Value: 0 }),
      new css.beans.PropertyValue({ Name: 'Hidden', Value: true }),
    ];
    sourceModel = desktop.loadComponentFromURL(`file:///tmp/office/${filename}`, '_blank', 0, openProperties);
    if (!sourceModel) throw new Error('convert-open-failed');
    const saveProperties = [
      new css.beans.PropertyValue({ Name: 'FilterName', Value: 'Calc MS Excel 2007 XML' }),
      new css.beans.PropertyValue({ Name: 'Overwrite', Value: true }),
    ];
    sourceModel.storeAsURL(`file:///tmp/office/${output}`, saveProperties);
    zetajs.mainPort.postMessage({ cmd: 'converted' });
  } catch {
    zetajs.mainPort.postMessage({ cmd: 'convert-failed' });
  } finally {
    try { sourceModel?.dispose(); } catch { /* 변환 문서는 다음 작업 전에 정리합니다. */ }
  }
}

function openFile(filename) {
  try {
    try { documentModel?.dispose(); } catch { /* 이전 문서는 새 문서를 열기 전에 정리합니다. */ }
    const properties = [
      new css.beans.PropertyValue({ Name: 'MacroExecutionMode', Value: 0 }),
      new css.beans.PropertyValue({ Name: 'UpdateDocMode', Value: 0 }),
    ];
    documentModel = desktop.loadComponentFromURL(`file:///tmp/office/${filename}`, '_default', 0, properties);
    if (!documentModel) throw new Error('open-failed');
    const controller = documentModel.getCurrentController();
    controller.getFrame().getContainerWindow().FullScreen = true;
    zetajs.mainPort.postMessage({ cmd: 'opened' });
  } catch {
    zetajs.mainPort.postMessage({ cmd: 'open-failed' });
  }
}

Module.zetajs.then(function (loadedZetajs) {
  zetajs = loadedZetajs;
  css = zetajs.uno.com.sun.star;
  startOffice();
});
