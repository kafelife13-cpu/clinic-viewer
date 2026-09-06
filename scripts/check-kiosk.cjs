const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    for(const size of [{width:320,height:568},{width:1024,height:600},{width:768,height:1024}]){
      const context=await browser.newContext({viewport:size,hasTouch:true});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.hostname!=='kiosk.test')return route.fulfill({status:503,body:'{}'});
        const file=url.pathname==='/kiosk/'?'kiosk/index.html':url.pathname.slice(1);
        const full=path.resolve(root,file);
        if(!full.startsWith(root+path.sep)||!fs.existsSync(full))return route.fulfill({status:404,body:''});
        return route.fulfill({contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':'text/html',body:fs.readFileSync(full)});
      });
      await page.goto('http://kiosk.test/kiosk/');
      for(const key of ['1','2','3','4'])await page.locator(`[data-k="${key}"]`).tap();
      assert.equal(await page.locator('#phoneDisplay').textContent(),'1234');
      await page.locator('[data-k="back"]').tap();
      assert.equal(await page.locator('#phoneDisplay').textContent(),'123');
      await page.locator('#confirmBtn').tap();
      await page.locator('#dismissResultBtn').tap();
      await page.locator('[data-k="7"]').tap();
      assert.equal(await page.locator('#phoneDisplay').textContent(),'7');
      assert.deepEqual(errors,[]);
      await context.close();
    }
    const manager=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
    const kiosk=JSON.parse(fs.readFileSync(path.join(root,'kiosk/manifest.json')));
    assert.equal(manager.start_url,'./');
    assert.notEqual(new URL(manager.id,'https://example.test/').href,new URL(kiosk.id,'https://example.test/kiosk/').href);
    console.log('PASS: touch keypad, backspace, result dismissal at three screen sizes; separate installed app identities.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
