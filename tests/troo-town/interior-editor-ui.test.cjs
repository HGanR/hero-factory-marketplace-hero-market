const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const deps=process.env.TOWN_TEST_DEPS||path.resolve(__dirname,'../../../stadium-test-deps/node_modules');
const {JSDOM}=require(deps+'/jsdom'),React=require(deps+'/react'),esbuild=require(deps+'/esbuild');
const dom=new JSDOM('<!doctype html><body/>',{url:'https://town.test'});global.window=dom.window;global.document=dom.window.document;Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});global.HTMLElement=dom.window.HTMLElement;global.IS_REACT_ACT_ENVIRONMENT=true;
const {render,fireEvent,screen,waitFor,cleanup,act}=require(deps+'/@testing-library/react');
const root=path.resolve(__dirname,'../..'),out=fs.mkdtempSync(os.tmpdir()+'/interior-editor-');
esbuild.buildSync({entryPoints:[root+'/src/components/world-editor/BuildingInteriorEditor.tsx'],outfile:out+'/editor.cjs',bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime'],nodePaths:[deps],tsconfigRaw:{compilerOptions:{baseUrl:root,paths:{'@/*':['src/*']}}}});
const Editor=require(out+'/editor.cjs').default;
test.afterEach(cleanup);
test('owner selects a compatible floor slot, adds and rotates furnishings, then removes them',async()=>{
 global.fetch=async()=>({ok:true,json:async()=>({npcs:[{npcId:'public-guide',name:'Guide'}]})});
 let items=[];const placement={id:'building',assetId:'storefront',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 function Harness(){const [value,setValue]=React.useState([]);return React.createElement(Editor,{placement:{...placement,interior:value},onChange:v=>{items=v;setValue(v)}})}
 render(React.createElement(Harness));await act(async()=>{});await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Add to building'}).disabled));
 fireEvent.change(screen.getByLabelText('Location'),{target:{value:'SLOT_furniture_F2_02'}});fireEvent.click(screen.getByRole('button',{name:'Add to building'}));assert.equal(items.length,1);assert.equal(items[0].kind,'desk');
 fireEvent.change(screen.getByLabelText('Rotation Floor 2 · Position 2'),{target:{value:'1.5'}});assert.equal(items[0].rotationY,1.5);
 fireEvent.click(screen.getByRole('button',{name:'Remove'}));assert.equal(items.length,0);
 fireEvent.change(screen.getByLabelText('Furnishing'),{target:{value:'agent'}});await screen.findByRole('option',{name:'Guide'});
 fireEvent.change(screen.getByLabelText('Public AI agent'),{target:{value:'public-guide'}});fireEvent.change(screen.getByLabelText('Location'),{target:{value:'SLOT_furniture_F2_02'}});fireEvent.click(screen.getByRole('button',{name:'Add to building'}));assert.equal(items[0].agentId,'public-guide');
});
test('no selected owned storefront gives clear guidance without editing controls',async()=>{
 global.fetch=async()=>({ok:true,json:async()=>({npcs:[]})});render(React.createElement(Editor,{placement:null,onChange(){throw Error('Unexpected change')}}));
 await act(async()=>{});assert.match(screen.getByText(/Select your placed storefront/).textContent,/furnish/);assert.equal(screen.queryByRole('button',{name:'Add to building'}),null);
});
test('Green Terrain uses the same furniture editor with arbitrary building coordinates and no purchase action',async()=>{
 const requests=[];global.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>({npcs:[]})}};
 let items=[];const placement={id:'nexus-tower',assetId:'nexus-tower',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 function Harness(){const[value,setValue]=React.useState([]);return React.createElement(Editor,{placement:{...placement,interior:value},freePlacement:true,saveHint:'Save World Layout to show visitors.',onChange:v=>{items=v;setValue(v)}})}
 render(React.createElement(Harness));await act(async()=>{});
 fireEvent.change(screen.getByLabelText('New furnishing Y'),{target:{value:'6.4'}});fireEvent.click(screen.getByRole('button',{name:'Add to building'}));
 assert.equal(items.length,1);assert.deepEqual(items[0].position,[0,6.4,0]);assert.deepEqual(requests,['/api/troo-world/npcs']);
 assert.match(screen.getByText('Save World Layout to show visitors.').textContent,/Save World/);
});
