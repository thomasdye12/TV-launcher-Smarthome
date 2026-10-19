const {test}=require('node:test');
const assert=require('node:assert/strict');
const {settings}=require('../scripts/configure.cjs');
test('deployment pins exact HTTPS origin, identity, and explicit experiment mode',()=>{
 const data=settings({remoteUrl:'https://tv.example:8443/samsung/',tvId:'room-1'});
 assert.equal(data.origin,'https://tv.example:8443');
 assert.equal(new URL(data.url).searchParams.get('tvId'),'room-1');
 assert.deepEqual(data.videoRectangle,['2%','2%','96%','96%']);
 assert.deepEqual(settings({remoteUrl:'https://tv.example/samsung/',tvId:'room-2',videoMode:'fullscreen'}).videoRectangle,['0%','0%','100%','100%']);
 for(const remoteUrl of ['http://tv.example/','https://user:secret@tv.example/','https://tv.example/samsung','https://tv.example/?token=x']) assert.throws(()=>settings({remoteUrl,tvId:'room'}));
 assert.throws(()=>settings({remoteUrl:'https://tv.example/',tvId:'../other'}));
});
