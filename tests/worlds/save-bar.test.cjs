const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { createRoot } = require('react-dom/client');
const { JSDOM } = require('jsdom');
const { act } = React;
const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../src/components/world-editor/DraftSaveBar.tsx'),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}
}).outputText;
async function fixture(overrides={}) {
 const dom = new JSDOM('<div id="root"></div>',{url:'https://worlds.example.test'});
 global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
 const module={exports:{}};
 vm.runInNewContext(code,{exports:module.exports,module,window:dom.window,navigator:dom.window.navigator,require:id=>id==='next/link'?{__esModule:true,default:({href,children,...props})=>React.createElement('a',{href,...props},children)}:require(id)});
 const root=createRoot(dom.window.document.getElementById('root'));
 const calls=[];let props={worldId:'world-a',worldName:'My World',visibility:'private',status:'draft',hasUnsavedChanges:true,saving:false,publishing:false,
 onSaveDraft:()=>calls.push('save'),onPublish:()=>calls.push('publish'),onVisibilityChange:value=>calls.push(value),...overrides};
 const render=async(next={})=>{props={...props,...next};await act(async()=>root.render(React.createElement(module.exports.DraftSaveBar,props)));};
 await render();return {dom,calls,render,close:async()=>{await act(async()=>root.unmount());dom.window.close();},button:text=>[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent===text)};
}
test('Save My World remains visible, triggers save, and shows dirty-state feedback',async()=>{
 const f=await fixture();try{await act(async()=>f.button('Save My World').click());assert.deepEqual(f.calls,['save']);assert.match(document.querySelector('[role=status]').textContent,/Unsaved changes/);}finally{await f.close();}
});
test('world address remains stable across rerenders and differs for another world',async()=>{
 const f=await fixture();try{const address=()=>document.querySelector('input').value;assert.equal(address(),'https://worlds.example.test/worlds/world-a');await f.render({worldName:'Renamed'});assert.equal(address(),'https://worlds.example.test/worlds/world-a');await f.render({worldId:'world-b'});assert.equal(address(),'https://worlds.example.test/worlds/world-b');}finally{await f.close();}
});
test('copy failure offers selectable address instead of claiming success',async()=>{
 const f=await fixture();try{await act(async()=>f.button('Copy world link').click());assert.match(document.querySelector('[role=status]').textContent,/Select the world address/);assert.ok(document.querySelector('input').readOnly);}finally{await f.close();}
});
test('saving disables overlapping writes and failures retain a retry control',async()=>{
 const f=await fixture({saving:true});try{assert.equal(f.button('Saving…').disabled,true);assert.equal(f.button('Publish saved world').disabled,true);await f.render({saving:false,message:'Save failed. Please retry.'});assert.equal(f.button('Save My World').disabled,false);assert.match(document.querySelector('[role=status]').textContent,/Save failed/);}finally{await f.close();}
});
test('sharing is explicit about access and published snapshot, visibility choice is forwarded',async()=>{
 const f=await fixture();try{assert.match(document.querySelector('[role=status]').textContent,/Visitors need a published world/);const select=document.querySelector('select');await act(async()=>{select.value='unlisted';select.dispatchEvent(new window.Event('change',{bubbles:true}));});assert.deepEqual(f.calls,['unlisted']);await f.render({visibility:'unlisted',status:'published'});assert.match(document.querySelector('[role=status]').textContent,/Visitors see your last published version/);}finally{await f.close();}
});
