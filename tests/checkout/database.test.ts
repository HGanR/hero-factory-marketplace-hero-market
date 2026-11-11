import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import mysql from 'mysql2/promise';
import {privateKeyToAccount} from 'viem/accounts';
import {encodeEventTopics,encodeAbiParameters,parseAbi} from 'viem';
import {TOKEN,TREASURY} from '../../src/lib/world-checkout/policy';

test('isolated MySQL ownership and signed receipt integration',async()=>{
  assert.equal(process.env.CHECKOUT_TEST_DATABASE,'1','This test runs only against the CI database.');
  const url=process.env.DATABASE_URL!;
  const parsed=new URL(url);assert.equal(parsed.hostname,'127.0.0.1');assert.equal(parsed.pathname,'/checkout_test');
  const db=await mysql.createConnection(url);
  await db.query('CREATE TABLE marketplace_users (id INT PRIMARY KEY,isActive BOOLEAN,isApproved BOOLEAN) ENGINE=InnoDB');
  await db.query('CREATE TABLE world_library_assets (id VARCHAR(36) PRIMARY KEY,name TEXT,tokenPrice INT,supplyLimit INT NULL,status VARCHAR(20),isActive BOOLEAN,isPlatformOnly BOOLEAN) ENGINE=InnoDB');
  await db.query('CREATE TABLE user_world_assets (id VARCHAR(36) PRIMARY KEY,userId INT,assetId VARCHAR(36),licenseScope VARCHAR(40),purchaseTx VARCHAR(128),INDEX(assetId),INDEX(userId)) ENGINE=InnoDB');
  await db.query('INSERT INTO marketplace_users VALUES (1,1,1),(2,1,1),(3,0,1)');
  for(const [id,price,limit] of [['paid',1,null],['second',1,null],['free',0,null],['scarce',1,1]])await db.execute('INSERT INTO world_library_assets VALUES (?,?,?, ?,?,1,0)',[id,id,price,limit,'published']);
  const account=privateKeyToAccount(('0x'+'1'.repeat(64)) as `0x${string}`);
  const hash=('0x'+'a'.repeat(64)) as `0x${string}`;
  const blockHash='0x'+'b'.repeat(64);
  let latest=100;let amount=10n**18n;let recipient=TREASURY;let timestamp=Math.floor(Date.now()/1000);
  const server=createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    const request=JSON.parse(raw);
    const answer=(r:any)=>{
      let result:any;
      switch(r.method){
        case 'eth_chainId': result='0x89';break;
        case 'eth_blockNumber': result='0x'+latest.toString(16);break;
        case 'eth_getTransactionReceipt': result={transactionHash:hash,blockHash,blockNumber:'0x65',status:'0x1',from:account.address,to:TOKEN,transactionIndex:'0x0',cumulativeGasUsed:'0x10000',gasUsed:'0x10000',effectiveGasPrice:'0x1',logsBloom:'0x'+'0'.repeat(512),type:'0x2',logs:[{address:TOKEN,topics:encodeEventTopics({abi:parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']),eventName:'Transfer',args:{from:account.address,to:recipient as `0x${string}`}}),data:encodeAbiParameters([{type:'uint256'}],[amount]),blockHash,blockNumber:'0x65',transactionHash:hash,transactionIndex:'0x0',logIndex:'0x0',removed:false}]};break;
        case 'eth_getTransactionByHash': result={hash,from:account.address,to:TOKEN,blockNumber:'0x65',blockHash,transactionIndex:'0x0',value:'0x0',gas:'0x10000',gasPrice:'0x1',nonce:'0x1',input:'0x',type:'0x0',v:'0x1b',r:'0x1',s:'0x1'};break;
        case 'eth_getBlockByNumber': result={number:'0x65',hash:blockHash,timestamp:'0x'+timestamp.toString(16),transactions:[],gasLimit:'0x100000',gasUsed:'0x10000',size:'0x100',difficulty:'0x0',totalDifficulty:'0x0',nonce:'0x0000000000000000'};break;
        default:throw new Error('Unexpected RPC '+r.method);
      }return {jsonrpc:'2.0',id:r.id,result};
    };
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(Array.isArray(request)?request.map(answer):answer(request)));
  });
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  process.env.POLYGON_RPC_URL='http://127.0.0.1:'+(server.address() as any).port;
  process.env.JWT_SECRET='ci-only-not-a-production-secret-1234567890';
  try {
    const {prepareOrder,fulfillAsset}=await import('../../src/lib/world-checkout/server');
    await assert.rejects(()=>fulfillAsset(1,'paid',{txRef:hash}),/Verified TROO/);
    await assert.rejects(()=>prepareOrder(3,'paid',account.address),/approved active/);
    await assert.rejects(()=>prepareOrder(1,'scarce',account.address),/limited-supply/);
    const free=await fulfillAsset(1,'free',{});assert.equal(free.success,true);
    assert.equal((await fulfillAsset(1,'free',{})).alreadyOwned,true);
    const quote:any=await prepareOrder(1,'paid',account.address);
    const second:any=await prepareOrder(2,'second',account.address);
    const body={orderToken:quote.orderToken,signature:await account.signMessage({message:quote.message}),txRef:hash};
    latest=132;timestamp=Math.floor(Date.now()/1000);
    await assert.rejects(()=>fulfillAsset(2,'paid',body),/does not match/);
    amount=1n;await assert.rejects(()=>fulfillAsset(1,'paid',body),/amount does not match/);amount=10n**18n;
    recipient=account.address;await assert.rejects(()=>fulfillAsset(1,'paid',body),/recipient/);recipient=TREASURY;
    const result=await fulfillAsset(1,'paid',body);assert.equal(result.success,true);
    assert.equal((await fulfillAsset(1,'paid',body)).alreadyOwned,true);
    const secondSignature=await account.signMessage({message:second.message});
    await assert.rejects(()=>fulfillAsset(2,'second',{orderToken:second.orderToken,signature:secondSignature,txRef:hash}),/already been used/);
    const [rows]:any=await db.query('SELECT COUNT(*) AS n FROM user_world_assets');assert.equal(rows[0].n,2);
  } finally {await db.end();await new Promise<void>(r=>server.close(()=>r()));}
});
