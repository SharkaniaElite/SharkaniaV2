import assert from "node:assert/strict";
import { createRequire } from "node:module";
const {chromium}=createRequire(process.env.QA_PLAYWRIGHT_ROOT+"/package.json")("playwright");
assert.equal(process.env.GITHUB_ACTIONS,"true");
assert.equal(process.env.QA_LOCAL_URL,"http://127.0.0.1:4173");
const local=process.env.QA_LOCAL_URL;
const browser=await chromium.launch({headless:true});
const title="QA noticia ficticia — titular extenso para verificar navegación editorial y el diseño adaptable de Sharkania";
const stamp="2026-11-22T12:00:00Z";
const post={id:"11111111-1111-4111-8111-111111111111",slug:"qa-noticia",title,category:"Noticias",excerpt:"Texto ficticio de prueba",published:true,published_at:stamp,created_at:stamp,read_time:1,unique_views:0,body:[{type:"p",content:"Contenido ficticio de QA"}],image_thumbnail:"/qa-image.svg",image_hero:"/qa-image.svg",tags:[]};
try{
 for(const host of ["sharkania.com","qa.sharkaniav2.pages.dev"]){
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:"block"});
  await context.addInitScript(()=>localStorage.setItem("sharkania_age_verified","true"));
  const errors=[],analytics=[],authRequests=[],blocked=[];
  await context.route("**/*",async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.hostname===host){
      if(u.pathname==="/qa-image.svg"){await route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#13596c"/></svg>'});return;}
      if(u.pathname.startsWith("/api/")){await route.fulfill({json:{}});return;}
      const response=await route.fetch({url:local+u.pathname+u.search});
      await route.fulfill({response});return;
    }
    if(u.hostname==="qa-fake.supabase.co"){
      if(u.pathname.startsWith("/auth/")){authRequests.push(u.pathname);await route.fulfill({status:401,json:{message:"synthetic anonymous"}});return;}
      if(u.pathname==="/rest/v1/blog_posts"){await route.fulfill({json:u.searchParams.has("slug")?post:[post]});return;}
      await route.fulfill({json:[]});return;
    }
    if(/posthog\.com$|clarity\.ms$|googletagmanager\.com$|google-analytics\.com$/.test(u.hostname)){
      analytics.push(u.hostname);
      await route.fulfill({status:200,contentType:req.resourceType()==="script"?"application/javascript":"application/json",body:req.resourceType()==="script"?"":"{}"});
      return;
    }
    blocked.push(u.hostname);await route.abort();
  });
  const page=await context.newPage();
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto("http://"+host+"/noticias",{waitUntil:"domcontentloaded"});
  await page.getByRole("heading",{name:title,exact:true}).waitFor({timeout:20000});
  assert.equal(await page.locator(".arena-news-featured-media").count(),1);
  const dimensions=await page.locator(".arena-news-featured").evaluate(el=>({a:el.getBoundingClientRect().height,b:el.querySelector(".arena-news-featured-media").getBoundingClientRect().height}));
  assert.ok(Math.abs(dimensions.a-dimensions.b)<=3,"featured card gap");
  await page.getByRole("button",{name:"Promociones",exact:true}).click();
  await page.getByText("No hay noticias en esta categoría").waitFor();
  await page.getByRole("button",{name:"Todas",exact:true}).click();
  await page.getByRole("heading",{name:title,exact:true}).waitFor();
  if(host==="sharkania.com"){
    await page.getByRole("heading",{name:title,exact:true}).click();
    await page.waitForURL("**/noticias/qa-noticia");
    await page.getByRole("heading",{level:1,name:title,exact:true}).waitFor({timeout:20000});
    await page.goBack();await page.getByRole("heading",{name:title,exact:true}).waitFor();
    await page.goto("http://"+host+"/dashboard");
    await page.waitForURL("**/login?redirect=*",{timeout:20000});
    await page.getByText("Inicia sesión en tu cuenta",{exact:true}).waitFor();
    assert.ok(analytics.some(x=>x.endsWith("posthog.com")),"PostHog made no intercepted synthetic request");
  }else{
    await page.goto("http://"+host+"/login");
    await page.getByRole("heading",{name:"Vista previa de diseño"}).waitFor();
    assert.equal(analytics.length,0,"preview analytics leak");
    assert.equal(authRequests.length,0,"preview auth request");
  }
  assert.deepEqual(errors,[],"uncaught page errors");
  console.log("PASS browser synthetic host "+host+": navigation, featured layout and auth/analytics isolation");
  await context.close();
 }
}finally{await browser.close();}
