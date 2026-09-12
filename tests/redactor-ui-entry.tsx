import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '../src/i18n/config';
import '../src/styles/tailwind.css';
import '../src/styles/global.css';
import { DocumentRedactorPage } from '../src/features/document-redactor/DocumentRedactorPage';

const language=new URLSearchParams(location.search).get('lang')==='en'?'en':'ko';
const root=createRoot(document.getElementById('root')!);
root.render(<StrictMode><MemoryRouter initialEntries={[`/${language}/document-redactor`]}><Routes><Route path="/:lang/*" element={<DocumentRedactorPage/>}/></Routes></MemoryRouter></StrictMode>);
(window as unknown as {redactorUnmount?:()=>void}).redactorUnmount=()=>root.unmount();
