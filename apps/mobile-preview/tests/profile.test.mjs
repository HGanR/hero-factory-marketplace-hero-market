import test from 'node:test';
import assert from 'node:assert/strict';
import {profileImage,safeAvatarThumbnail,readMemberProfile,saveMemberImage,readMemberWorlds} from '../shared/src/lib/mobile/profile.ts';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5FoAAAAASUVORK5CYII=';
test('profile accepts bounded PNGs and refuses executable, malformed and oversized uploads',()=>{
 assert.equal(profileImage(png,'avatarData'),png);assert.equal(profileImage(null,'bannerData'),null);
 for(const input of ['data:image/svg+xml;base64,PHN2Zz4=', 'https://example.test/image.png', 'data:image/png;base64,abc=', png+' ', 'data:image/png;base64,'+'A'.repeat(800000)]) assert.throws(()=>profileImage(input,'bannerData'));
 const bad=Buffer.from(png.split(',')[1],'base64');bad.writeUInt32BE(20000,16);assert.throws(()=>profileImage('data:image/png;base64,'+bad.toString('base64'),'bannerData'));
 assert.equal(safeAvatarThumbnail('javascript:alert(1)'),null);assert.equal(safeAvatarThumbnail('//unrelated.example/x'),null);
 assert.equal(safeAvatarThumbnail('/avatars/selected.png'),'https://troothhurtz.app/avatars/selected.png');
});
test('profile uses selected website avatar without modifying its model and scopes every read',async()=>{
 const calls=[];const db={execute:async(sql,params)=>{calls.push({sql,params});if(sql.includes('avatar_profiles'))return [[{displayName:'Chosen avatar',thumbnailUrl:'/avatars/chosen.png'}],[]];return [[],[]];}};
 const result=await readMemberProfile(db,7);assert.equal(result.selectedAvatar.thumbnailUrl,'https://troothhurtz.app/avatars/chosen.png');assert.equal(result.bannerData,null);
 assert.deepEqual(calls.map(c=>c.params),[[7],[7,'ready']]);assert.ok(calls.every(c=>c.sql.startsWith('SELECT')));
 await readMemberWorlds(db,7);assert.deepEqual(calls.at(-1).params,[7,'archived']);assert.match(calls.at(-1).sql,/ownerId = \?/);
});
test('image writes preserve the other image and existing assets; failures do not claim success',async()=>{
 const calls=[];const db={execute:async(sql,params)=>{calls.push({sql,params});return [{affectedRows:1},[]];}};
 await saveMemberImage(db,7,'bannerData',png);const first=calls[0];assert.deepEqual(first.params,[png,7]);assert.match(first.sql,/isActive = 1 AND isApproved = 1/);assert.match(first.sql,/UTC_TIMESTAMP/);assert.doesNotMatch(first.sql,/avatar_data|avatar_profiles/);
 await saveMemberImage(db,8,'avatarData',null);assert.doesNotMatch(calls[1].sql,/banner_data|avatar_profiles/);assert.deepEqual(calls[1].params,[null,8]);
 await assert.rejects(saveMemberImage({execute:async()=>[{affectedRows:0},[]]},7,'avatarData',png));
});
test('unavailable website avatars remain distinguishable from a member with no selection',async()=>{
 const profile=await readMemberProfile({execute:async(sql)=>{if(sql.includes('avatar_profiles'))throw Error('unavailable');return [[{bannerData:png}],[]];}},7);
 assert.equal(profile.bannerData,png);assert.equal(profile.avatarAvailable,false);assert.equal(profile.selectedAvatar,null);
});
