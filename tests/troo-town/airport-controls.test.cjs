/** Mount the actual React controls. Fiber/Drei are ports; mixer and supplied GLB are real. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),esbuild=require('esbuild');const root=path.resolve(__dirname,'../..'),deps=process.env.TOWN_TEST_DEPS;
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://town.test'});global.window=dom.window;global.document=dom.window.document;Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});global.HTMLElement=dom.window.HTMLElement;global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react'),{render,fireEvent,screen,act,cleanup}=require('@testing-library/react');
const out=fs.mkdtempSync(require('node:os').tmpdir()+'/airport-controls-');
let api;
test.before(async()=>{
 await esbuild.build({stdin:{contents:`export {default as AirportModel} from './src/components/green-terrain/AirportModel';export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';export {AIRPORT,placeAirport} from './src/lib/troo-world/airport';`,resolveDir:root},bundle:true,outfile:out+'/controls.cjs',platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime'],nodePaths:deps?[deps]:[],tsconfigRaw:{compilerOptions:{baseUrl:root,paths:{'@/*':['src/*']}}},plugins:[{name:'mount-ports',setup(b){b.onResolve({filter:/^@react-three\/(fiber|drei)$/},a=>({path:a.path,namespace:'port'}));b.onLoad({filter:/.*/,namespace:'port'},a=>({contents:a.path.endsWith('fiber')?`export function useFrame(fn){globalThis.__airportFrame=fn}`:`import React from 'react';export const useGLTF=()=>globalThis.__airportGltf;export const Html=({children})=>React.createElement('div',null,children);`,loader:'js'}));}}]});
 api=require(out+'/controls.cjs');const bytes=fs.readFileSync(root+'/public'+api.AIRPORT.modelUrl);global.__airportGltf=await new api.GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
});
test.afterEach(cleanup);
test('visitor controls pause, play, restart, seek stages and focus the saved placement',()=>{
 const placement=api.placeAirport([])[0];let focused;
 render(React.createElement(React.StrictMode,null,React.createElement(api.AirportModel,{placement,onFocus:p=>focused=p})));
 fireEvent.click(screen.getByRole('button',{name:/Airport · flight cycle/}));
 fireEvent.click(screen.getByRole('button',{name:'Takeoff',exact:true}));assert.match(screen.getByRole('status').textContent,/Takeoff · 23:25/);
 fireEvent.click(screen.getByRole('button',{name:'Pause cycle'}));act(()=>global.__airportFrame({},1));assert.match(screen.getByRole('status').textContent,/23:25/);
 fireEvent.change(screen.getByLabelText('Airport playback speed'),{target:{value:'30'}});fireEvent.click(screen.getByRole('button',{name:'Play cycle'}));act(()=>global.__airportFrame({},1));assert.match(screen.getByRole('status').textContent,/23:55/);
 fireEvent.click(screen.getByRole('button',{name:'View airport'}));assert.equal(focused,placement);
 fireEvent.click(screen.getByRole('button',{name:'Restart cycle'}));assert.match(screen.getByRole('status').textContent,/Deplaning · 0:00/);
 fireEvent.click(screen.getByRole('button',{name:'Landing and taxi in'}));assert.match(screen.getByRole('status').textContent,/27:45/);
});
