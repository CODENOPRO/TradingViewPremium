const test=require('node:test'),assert=require('node:assert/strict');
global.MarketData=require('../frontend/js/market_data.js');
const {TerminalTime}=require('../frontend/js/terminal_features.js');
const {TerminalMusicLinks}=require('../frontend/js/terminal_companions.js');
const stamp=s=>Date.parse(s)/1000;
const meta={timezone:'America/Chicago',session:'1700-1600',holidays:'20261225',sessionCorrections:'1700-1215:20261127;dayoff:20261126'};
test('exchange clock observes overnight weekdays, daily break, holiday and early close',()=>{
 for(const date of ['2026-11-13T22:01:00Z','2026-11-14T18:00:00Z','2026-11-15T22:59:00Z','2026-12-25T12:00:00Z','2026-11-27T18:16:00Z','2026-11-26T10:00:00Z'])assert.equal(TerminalTime.activeSession(stamp(date),meta),null,date);
 for(const date of ['2026-11-15T23:00:00Z','2026-11-27T18:14:00Z','2026-11-12T02:00:00Z'])assert.ok(TerminalTime.activeSession(stamp(date),meta),date);
});
test('DST changes exchange close UTC while keeping local session hours',()=>{
 const summer=TerminalTime.activeSession(stamp('2026-07-06T18:00:00Z'),meta),winter=TerminalTime.activeSession(stamp('2026-11-12T18:00:00Z'),meta);
 assert.equal(new Date(summer.end*1000).toISOString(),'2026-07-06T21:00:00.000Z');assert.equal(new Date(winter.end*1000).toISOString(),'2026-11-12T22:00:00.000Z');
});
test('corrections override holiday and support Fn and split sessions',()=>{
 const m={timezone:'Etc/UTC',session:'0900-1600',holidays:'20261112',sessionCorrections:'1900F2-2350F1,1000-1200:20261112'};
 assert.ok(TerminalTime.activeSession(stamp('2026-11-11T20:00:00Z'),m));assert.ok(TerminalTime.activeSession(stamp('2026-11-12T11:00:00Z'),m));assert.equal(TerminalTime.activeSession(stamp('2026-11-12T12:00:00Z'),m),null);
});
test('monthly close skips provider holiday and uses corrected last trading day',()=>{
 const m={timezone:'America/Chicago',session:'1700-1600',holidays:'20261231',sessionCorrections:'1700-1200:20261230'};
 assert.equal(new Date(TerminalTime.end({time:stamp('2026-12-01T00:00:00Z')},'1M',m)*1000).toISOString(),'2026-12-30T18:00:00.000Z');
});
test('official media links retain supported playlist and track identities',()=>{
 const yt=TerminalMusicLinks.parse('https://youtu.be/dQw4w9WgXcQ?list=PL123456789abc');assert.equal(yt.provider,'youtube');assert.equal(yt.list,'PL123456789abc');
 assert.equal(TerminalMusicLinks.parse('https://open.spotify.com/intl-en/playlist/37i9dQZF1DXcBWIGoYBM5M').type,'playlist');
 assert.equal(TerminalMusicLinks.parse('https://soundcloud.com/artist/sets/music').provider,'soundcloud');
 assert.equal(TerminalMusicLinks.parse('https://www.tiktok.com/@artist/video/1234567890123456789').id,'1234567890123456789');
});
test('rejects arbitrary, executable and redirect links instead of extracting audio',()=>{
 for(const link of ['javascript:alert(1)','https://www.youtube.com.evil.test/watch?v=dQw4w9WgXcQ','https://vm.tiktok.com.evil.test/abc','http://soundcloud.com/a/b','https://open.spotify.com/track/no','https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ'])assert.throws(()=>TerminalMusicLinks.parse(link));
});
test('routes official short links through resolution before choosing an embed',()=>{
 for(const url of ['https://vm.tiktok.com/example/','https://vt.tiktok.com/example/','https://on.soundcloud.com/example','https://spotify.link/example'])assert.deepEqual(TerminalMusicLinks.parse(url),{share:true,url});
 assert.equal(TerminalMusicLinks.parse('https://www.tiktok.com/player/v1/6718335390845095173').id,'6718335390845095173');
});
test('music links retain private SoundCloud tokens and fall back to a valid playlist when a video id is invalid',()=>{
 assert.equal(TerminalMusicLinks.parse('https://soundcloud.com/artist/private?secret_token=s-test&si=tracking').url,'https://soundcloud.com/artist/private?secret_token=s-test');
 assert.equal(TerminalMusicLinks.parse('https://www.youtube.com/watch?v=bad&list=PLabcdefghijk').url,'https://www.youtube.com/playlist?list=PLabcdefghijk');
});
