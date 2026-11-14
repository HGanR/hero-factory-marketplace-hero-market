/** Mount the actual React controls. Fiber/Drei are ports; mixer and supplied GLB are real. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),esbuild=require('esbuild');const root=path.resolve(__dirname,'../..'),deps=process.env.TOWN_TEST_DEPS;
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://town.test'});global.window=dom.window;global.document=dom.window.document;Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});global.HTMLElement=dom.window.HTMLElement;global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react'),{render,fireEvent,screen,act,cleanup}=require('@testing-library/react');
const out=fs.mkdtempSync(require('node:os').tmpdir()+'/airport-controls-');
let api;
test.before(async()=>{
 await esbuild.build({stdin:{contents:`export {default as ModelScaleControl} from './src/components/green-terrain/ModelScaleControl';export {default as AirportRoutesEditor} from './src/components/green-terrain/AirportRoutesEditor';export {default as AirportModel} from './src/components/green-terrain/AirportModel';export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';export {AIRPORT,placeAirport} from './src/lib/troo-world/airport';`,resolveDir:root},bundle:true,outfile:out+'/controls.cjs',platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime'],nodePaths:deps?[deps]:[],tsconfigRaw:{compilerOptions:{baseUrl:root,paths:{'@/*':['src/*']}}},plugins:[{name:'mount-ports',setup(b){b.onResolve({filter:/^@react-three\/(fiber|drei)$/},a=>({path:a.path,namespace:'port'}));b.onLoad({filter:/.*/,namespace:'port'},a=>({contents:a.path.endsWith('fiber')?`export function useFrame(fn){globalThis.__airportFrame=fn}`:`import React from 'react';export const useGLTF=()=>globalThis.__airportGltf;export const Html=({children})=>React.createElement('div',null,children);`,loader:'js'}));}}]});
 api=require(out+'/controls.cjs');const bytes=fs.readFileSync(root+'/public'+api.AIRPORT.modelUrl);global.__airportGltf=await new api.GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
});
test.afterEach(cleanup);
test('animation preview is available only in the editor',()=>{
 const placement=api.placeAirport([])[0];let focused;
 render(React.createElement(React.StrictMode,null,React.createElement(api.AirportModel,{placement,onFocus:p=>focused=p,editorMode:true})));
 fireEvent.click(screen.getByRole('button',{name:/Airport · Departures/}));
 fireEvent.click(screen.getByText('Animation preview (editor only)'));
 fireEvent.click(screen.getByRole('button',{name:'Takeoff',exact:true}));assert.match(screen.getByRole('status').textContent,/Takeoff · 23:25/);
 fireEvent.click(screen.getByRole('button',{name:'Pause cycle'}));act(()=>global.__airportFrame({},1));assert.match(screen.getByRole('status').textContent,/23:25/);
 fireEvent.change(screen.getByLabelText('Airport playback speed'),{target:{value:'30'}});fireEvent.click(screen.getByRole('button',{name:'Play cycle'}));act(()=>global.__airportFrame({},1));assert.match(screen.getByRole('status').textContent,/23:55/);
 fireEvent.click(screen.getByRole('button',{name:'View airport'}));assert.equal(focused,placement);
 fireEvent.click(screen.getByRole('button',{name:'Restart cycle'}));assert.match(screen.getByRole('status').textContent,/Deplaning · 0:00/);
 fireEvent.click(screen.getByRole('button',{name:'Landing and taxi in'}));assert.match(screen.getByRole('status').textContent,/27:45/);
});

test('visitors see named flights and no animation, camera, speed or route-edit controls',()=>{
 const placement={...api.placeAirport([])[0],destinations:[{id:'abc',name:'ABC',url:'https://member.example/world'}]};
 render(React.createElement(api.AirportModel,{placement,onFocus:()=>{throw Error('Visitor camera preview must not appear')}}));
 fireEvent.click(screen.getByRole('button',{name:/Airport · Departures/}));
 assert.equal(screen.getByRole('link',{name:'Fly to ABC'}).getAttribute('href'),'https://member.example/world');
 assert.equal(screen.queryByText('https://member.example/world'),null);
 for(const name of ['Pause cycle','Restart cycle','View airport','Takeoff','Deplaning','Add destination'])assert.equal(screen.queryByRole('button',{name,exact:true}),null);
 assert.equal(screen.queryByLabelText('Airport playback speed'),null);assert.equal(screen.queryByText('Animation preview (editor only)'),null);
});
test('an airport without configured destinations offers an honest empty board',()=>{
 render(React.createElement(api.AirportModel,{placement:api.placeAirport([])[0]}));fireEvent.click(screen.getByRole('button',{name:/Airport · Departures/}));assert.ok(screen.getByText('No destinations are scheduled yet.'));assert.equal(screen.queryAllByRole('link').length,0);
});
test('admin can add, rename and remove destinations; unsafe routes never reach the draft',()=>{
 let saved=[];function Harness(){const [destinations,setDestinations]=React.useState([]);return React.createElement(api.AirportRoutesEditor,{destinations,onChange:value=>{saved=value;setDestinations(value)}})}
 render(React.createElement(Harness));
 fireEvent.change(screen.getByLabelText('Destination name'),{target:{value:'ABC'}});fireEvent.change(screen.getByLabelText('Member world URL'),{target:{value:'javascript:alert(1)'}});fireEvent.click(screen.getByRole('button',{name:'Add destination'}));assert.equal(saved.length,0);assert.match(screen.getByRole('alert').textContent,/HTTPS/);
 fireEvent.change(screen.getByLabelText('Member world URL'),{target:{value:'https://member.example/world'}});fireEvent.click(screen.getByRole('button',{name:'Add destination'}));assert.equal(saved[0].name,'ABC');const id=saved[0].id;
 fireEvent.click(screen.getByRole('button',{name:'Edit ABC'}));fireEvent.change(screen.getByLabelText('Destination name'),{target:{value:'New Town'}});fireEvent.click(screen.getByRole('button',{name:'Update destination'}));assert.equal(saved[0].id,id);assert.equal(saved[0].name,'New Town');assert.equal(saved[0].url,'https://member.example/world');
 fireEvent.click(screen.getByRole('button',{name:'Remove New Town'}));assert.deepEqual(saved,[]);
});

test('airport and Veritas use stadium scale bounds, reset values and keyboard-safe labelled controls',()=>{
 let airport=.1,veritas=1;
 function Scales(){const [a,setA]=React.useState(airport),[v,setV]=React.useState(veritas);return React.createElement(React.Fragment,null,React.createElement(api.ModelScaleControl,{label:'Airport',value:a,resetValue:.1,onChange:n=>{airport=n;setA(n)}}),React.createElement(api.ModelScaleControl,{label:'Veritas',value:v,onChange:n=>{veritas=n;setV(n)}}));}
 render(React.createElement(Scales));fireEvent.change(screen.getByLabelText('Airport size slider'),{target:{value:'.25'}});assert.equal(airport,.25);fireEvent.change(screen.getByLabelText('Veritas size slider'),{target:{value:'1.5'}});assert.equal(veritas,1.5);
 fireEvent.change(screen.getByLabelText('Airport scale'),{target:{value:'0'}});assert.equal(airport,.25);fireEvent.change(screen.getByLabelText('Veritas scale'),{target:{value:'21'}});assert.equal(veritas,1.5);
 fireEvent.click(screen.getByRole('button',{name:'Reset Airport size'}));fireEvent.click(screen.getByRole('button',{name:'Reset Veritas size'}));assert.equal(airport,.1);assert.equal(veritas,1);
});
