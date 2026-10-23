import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';
import i18n from '../../../src/i18n/config';import{TextComparePage}from'../../../src/features/text-compare/TextComparePage';import{ImageComparePage}from'../../../src/features/image-compare/ImageComparePage';
import '../../../src/styles/tailwind.css';import '../../../src/styles/global.css';import '../../../src/styles/worklazy-theme.css';
const search=new URLSearchParams(location.search),root=createRoot(document.getElementById('root')!);
void i18n.changeLanguage(search.get('lang')||'en').then(()=>root.render(<React.StrictMode><BrowserRouter>{search.get('tool')==='image'?<ImageComparePage/>:<TextComparePage/>}</BrowserRouter></React.StrictMode>));

Object.assign(window,{switchToolForTest:(tool:string)=>root.render(<React.StrictMode><BrowserRouter>{tool==='image'?<ImageComparePage/>:<TextComparePage/>}</BrowserRouter></React.StrictMode>)});
