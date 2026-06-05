const PID = "824dc83d-e86a-454f-bd76-cee24bf7b81c";
const DB = "http://localhost:3000/api/mint-db";
const q = (t,p) => fetch(DB,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t,params:p})}).then(r=>r.json());
const uid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==="x"?r:(r&0x3)|0x8).toString(16)});
const ROOT = "00000000-0000-0000-0000-000000000000";

function mkRect(id,name,x,y,w,h,fill,parent,extra={}){return{id,name,type:"rect",x,y,width:w,height:h,fills:[{fillColor:fill,fillOpacity:1}],strokes:[],opacity:1,rotation:0,shapes:[],frameId:parent,parentId:parent,hidden:false,locked:false,...extra}}
function mkText(id,name,x,y,w,h,txt,fs,color,parent,extra={}){return{id,name,type:"text",x,y,width:w,height:h,fills:[{fillColor:color,fillOpacity:1}],strokes:[],opacity:1,rotation:0,shapes:[],frameId:parent,parentId:parent,hidden:false,locked:false,content:{children:[{children:[{text:txt,fontFamily:"Inter",fontSize:fs,fontWeight:extra.bold?700:400,fill:color}]}]},...extra}}
function mkFrame(id,name,x,y,w,h,fill,parent,children=[]){return{id,name,type:"frame",x,y,width:w,height:h,fills:[{fillColor:fill,fillOpacity:1}],strokes:[],opacity:1,rotation:0,shapes:children,frameId:parent||ROOT,parentId:parent||ROOT,hidden:false,locked:false,showContent:true}}

// ─── Dashboard Screen ───
function buildDashboard(){
  const f1=uid(), o={};
  // Sidebar
  const sb=uid(),sL=uid(),sN1=uid(),sN2=uid(),sN3=uid(),sN4=uid();
  o[sb]=mkFrame(sb,"Sidebar",0,0,240,900,"#111827",f1,[sL,sN1,sN2,sN3,sN4]);
  o[sL]=mkText(sL,"Logo",24,28,120,28,"⚡ CRM Pro",18,"#818cf8",sb,{bold:true});
  o[sN1]=mkText(sN1,"Nav Dashboard",24,80,180,20,"📊  Dashboard",14,"#e5e7eb",sb);
  o[sN2]=mkText(sN2,"Nav Contacts",24,114,180,20,"👥  Contacts",14,"#9ca3af",sb,{runtimeBindings:{onClick:"navigate:/contacts"}});
  o[sN3]=mkText(sN3,"Nav Pipeline",24,148,180,20,"🔄  Pipeline",14,"#9ca3af",sb,{runtimeBindings:{onClick:"navigate:/pipeline"}});
  o[sN4]=mkText(sN4,"Nav Activities",24,182,180,20,"📅  Activities",14,"#9ca3af",sb);
  // Header
  const hd=uid(),hT=uid(),hS=uid(),hA=uid();
  o[hd]=mkFrame(hd,"Header",240,0,1160,64,"#1f2937",f1,[hT,hS,hA]);
  o[hT]=mkText(hT,"Title",264,20,200,24,"Dashboard",20,"#f9fafb",hd,{bold:true});
  o[hS]=mkRect(hS,"Search",700,16,300,32,"#374151",hd,{rx:8,runtimeBindings:{inputBind:"$search.query"}});
  o[hA]=mkRect(hA,"Avatar",1348,16,32,32,"#818cf8",hd,{rx:16});
  // Stat cards
  const sc=uid();const ids=[];
  [{l:"Total Revenue",v:"$284,500",c:"#34d399",bind:"$stats.revenue"},{l:"Active Deals",v:"147",c:"#60a5fa",bind:"$stats.deals"},{l:"New Leads",v:"63",c:"#f472b6",bind:"$stats.leads"},{l:"Win Rate",v:"72%",c:"#fbbf24",bind:"$stats.winRate"}].forEach((s,i)=>{
    const bg=uid(),lt=uid(),vt=uid();const cx=264+i*278;
    o[bg]=mkRect(bg,s.l+" Card",cx,88,254,120,"#1e293b",sc,{rx:12});
    o[lt]=mkText(lt,s.l+" Label",cx+20,104,120,16,s.l,12,"#94a3b8",sc);
    o[vt]=mkText(vt,s.l+" Value",cx+20,132,160,32,s.v,28,s.c,sc,{bold:true,runtimeBindings:{textBind:s.bind}});
    ids.push(bg,lt,vt);
  });
  o[sc]=mkFrame(sc,"Stats",264,88,1112,120,"transparent",f1,ids);
  // Chart
  const ch=uid(),cT=uid(),cB=uid();
  o[ch]=mkFrame(ch,"Chart",264,232,720,320,"#1e293b",f1,[cT,cB]);
  o[cT]=mkText(cT,"Chart Title",284,248,200,20,"Revenue Trend",16,"#f1f5f9",ch,{bold:true});
  o[cB]=mkRect(cB,"Chart Area",284,280,680,256,"#0f172a",ch,{rx:8});
  // Deals table
  const tb=uid(),tbT=uid();const rIds=[];
  [{n:"Acme Corp — Enterprise",a:"$45,000",c:"#34d399"},{n:"TechStart — Pro Plan",a:"$12,500",c:"#60a5fa"},{n:"GlobalFin — Audit",a:"$78,000",c:"#fbbf24"}].forEach((d,i)=>{
    const bg=uid(),nt=uid(),at=uid();const ry=284+i*56;
    o[bg]=mkRect(bg,"Row"+i,1024,ry,336,48,"#111827",tb,{rx:8});
    o[nt]=mkText(nt,"Name"+i,1040,ry+12,200,16,d.n,13,"#e2e8f0",tb,{runtimeBindings:{textBind:"$deals["+i+"].name"}});
    o[at]=mkText(at,"Amt"+i,1280,ry+12,80,16,d.a,13,d.c,tb,{bold:true,runtimeBindings:{textBind:"$deals["+i+"].amount"}});
    rIds.push(bg,nt,at);
  });
  o[tb]=mkFrame(tb,"Recent Deals",1008,232,368,320,"#1e293b",f1,[tbT,...rIds]);
  o[tbT]=mkText(tbT,"Table Title",1028,248,200,20,"Recent Deals",16,"#f1f5f9",tb,{bold:true});
  // Activity feed
  const fd=uid(),fT=uid(),a1=uid(),a2=uid(),a3=uid();
  o[fd]=mkFrame(fd,"Activity",264,576,1112,280,"#1e293b",f1,[fT,a1,a2,a3]);
  o[fT]=mkText(fT,"Feed Title",284,592,200,20,"Recent Activity",16,"#f1f5f9",fd,{bold:true});
  o[a1]=mkText(a1,"Act1",284,628,500,16,"🟢  Sarah closed deal with Acme Corp — $45,000",13,"#d1d5db",fd,{runtimeBindings:{dataSource:"activities",repeatFor:"$activities",repeatAs:"activity"}});
  o[a2]=mkText(a2,"Act2",284,658,500,16,"🔵  New lead: James Miller from TechVentures",13,"#d1d5db",fd);
  o[a3]=mkText(a3,"Act3",284,688,500,16,"🟡  Meeting scheduled with GlobalFin — Tomorrow 2pm",13,"#d1d5db",fd);
  // Main frame
  o[f1]=mkFrame(f1,"Dashboard",0,0,1400,900,"#0f172a",ROOT,[sb,hd,sc,ch,tb,fd]);
  return {id:f1,objects:o};
}

// ─── Contacts Screen ───
function buildContacts(){
  const sx=1500,f2=uid(),o={};
  const sb=uid(),sL=uid(),sN1=uid(),sN2=uid();
  o[sb]=mkFrame(sb,"Sidebar",sx,0,240,900,"#111827",f2,[sL,sN1,sN2]);
  o[sL]=mkText(sL,"Logo",sx+24,28,120,28,"⚡ CRM Pro",18,"#818cf8",sb,{bold:true});
  o[sN1]=mkText(sN1,"Nav Dash",sx+24,80,180,20,"📊  Dashboard",14,"#9ca3af",sb,{runtimeBindings:{onClick:"navigate:/dashboard"}});
  o[sN2]=mkText(sN2,"Nav Contacts",sx+24,114,180,20,"👥  Contacts",14,"#e5e7eb",sb);
  // Header
  const hd=uid(),hT=uid(),ab=uid(),aT=uid();
  o[hd]=mkFrame(hd,"Header",sx+240,0,1160,64,"#1f2937",f2,[hT,ab,aT]);
  o[hT]=mkText(hT,"Title",sx+264,20,200,24,"Contacts",20,"#f9fafb",hd,{bold:true});
  o[ab]=mkRect(ab,"Add Btn",sx+1260,16,120,32,"#818cf8",hd,{rx:8,runtimeBindings:{onClick:"openModal:addContact"}});
  o[aT]=mkText(aT,"Add Txt",sx+1275,22,100,18,"+ Add Contact",12,"#ffffff",hd,{bold:true});
  // Table header
  const th=uid(),cols=[];
  ["Name","Email","Company","Status","Value"].forEach((c,i)=>{
    const t=uid();o[t]=mkText(t,"Col "+c,sx+284+i*180,90,160,16,c,12,"#94a3b8",th,{bold:true});cols.push(t);
  });
  o[th]=mkFrame(th,"Table Head",sx+264,80,1112,40,"#1e293b",f2,cols);
  // Rows
  const rows=[];
  [{n:"Sarah Johnson",e:"sarah@acme.com",co:"Acme Corp",s:"Customer",sc:"#34d399",v:"$45,000"},
   {n:"James Miller",e:"james@techv.io",co:"TechVentures",s:"Lead",sc:"#60a5fa",v:"—"},
   {n:"Emily Chen",e:"emily@global.com",co:"GlobalFin",s:"Prospect",sc:"#fbbf24",v:"$78,000"},
   {n:"Michael Brown",e:"m@startup.co",co:"StartupCo",s:"Customer",sc:"#34d399",v:"$23,400"},
   {n:"Lisa Wang",e:"lisa@ent.io",co:"EnterpriseSys",s:"Lead",sc:"#60a5fa",v:"—"},
   {n:"David Kim",e:"david@innov.dev",co:"InnovateDev",s:"Prospect",sc:"#f472b6",v:"$56,000"}
  ].forEach((c,i)=>{
    const ry=130+i*52,bg=uid(),n=uid(),e=uid(),co=uid(),sb2=uid(),st=uid(),vl=uid();
    o[bg]=mkRect(bg,"Row"+i,sx+264,ry,1112,48,i%2===0?"#111827":"#0f172a",f2,{rx:4});
    o[n]=mkText(n,"Name"+i,sx+284,ry+14,160,16,c.n,13,"#e2e8f0",f2,{runtimeBindings:{textBind:"$contacts["+i+"].name"}});
    o[e]=mkText(e,"Email"+i,sx+464,ry+14,160,16,c.e,13,"#94a3b8",f2);
    o[co]=mkText(co,"Company"+i,sx+644,ry+14,160,16,c.co,13,"#cbd5e1",f2);
    o[sb2]=mkRect(sb2,"StatusBg"+i,sx+824,ry+10,80,24,c.sc+"20",f2,{rx:12});
    o[st]=mkText(st,"Status"+i,sx+836,ry+14,60,16,c.s,11,c.sc,f2,{bold:true});
    o[vl]=mkText(vl,"Val"+i,sx+1004,ry+14,100,16,c.v,13,"#e2e8f0",f2);
    rows.push(bg,n,e,co,sb2,st,vl);
  });
  o[f2]=mkFrame(f2,"Contacts",sx,0,1400,900,"#0f172a",ROOT,[sb,hd,th,...rows]);
  return {id:f2,objects:o};
}

// ─── Pipeline Screen ───
function buildPipeline(){
  const sx=3100,f3=uid(),o={};
  const sb=uid(),sL=uid(),sN1=uid(),sN2=uid(),sN3=uid();
  o[sb]=mkFrame(sb,"Sidebar",sx,0,240,900,"#111827",f3,[sL,sN1,sN2,sN3]);
  o[sL]=mkText(sL,"Logo",sx+24,28,120,28,"⚡ CRM Pro",18,"#818cf8",sb,{bold:true});
  o[sN1]=mkText(sN1,"Nav1",sx+24,80,180,20,"📊  Dashboard",14,"#9ca3af",sb,{runtimeBindings:{onClick:"navigate:/dashboard"}});
  o[sN2]=mkText(sN2,"Nav2",sx+24,114,180,20,"👥  Contacts",14,"#9ca3af",sb,{runtimeBindings:{onClick:"navigate:/contacts"}});
  o[sN3]=mkText(sN3,"Nav3",sx+24,148,180,20,"🔄  Pipeline",14,"#e5e7eb",sb);
  const hd=uid(),hT=uid();
  o[hd]=mkFrame(hd,"Header",sx+240,0,1160,64,"#1f2937",f3,[hT]);
  o[hT]=mkText(hT,"Title",sx+264,20,200,24,"Pipeline",20,"#f9fafb",hd,{bold:true});
  // Kanban
  const colData=[
    {t:"New Leads",c:"#818cf8",d:[{n:"TechStart",v:"$12,500"},{n:"DataFlow",v:"$8,200"}]},
    {t:"Qualified",c:"#60a5fa",d:[{n:"Acme Corp",v:"$45,000"},{n:"CloudNet",v:"$28,000"},{n:"SyncTech",v:"$15,600"}]},
    {t:"Proposal",c:"#fbbf24",d:[{n:"GlobalFin",v:"$78,000"},{n:"MegaCo",v:"$34,000"}]},
    {t:"Closed Won",c:"#34d399",d:[{n:"EntSys",v:"$92,000"}]}
  ];
  const colIds=[];
  colData.forEach((col,ci)=>{
    const cx=sx+264+ci*280,cf=uid(),ct=uid();const kids=[ct];
    o[ct]=mkText(ct,col.t+" Title",cx+16,92,200,18,col.t,14,col.c,cf,{bold:true});
    col.d.forEach((deal,di)=>{
      const cy=124+di*100,card=uid(),cn=uid(),cv=uid();
      o[card]=mkRect(card,deal.n+" Card",cx+12,cy,240,84,"#1e293b",cf,{rx:10,runtimeBindings:{dataSource:"deals",onClick:"openModal:dealDetail"}});
      o[cn]=mkText(cn,deal.n+" Name",cx+24,cy+16,180,16,deal.n,14,"#e2e8f0",cf,{bold:true,runtimeBindings:{textBind:"$deal.name"}});
      o[cv]=mkText(cv,deal.n+" Val",cx+24,cy+42,100,14,deal.v,13,col.c,cf,{runtimeBindings:{textBind:"$deal.value"}});
      kids.push(card,cn,cv);
    });
    o[cf]=mkFrame(cf,col.t,cx,76,264,800,"#111827",f3,kids);
    colIds.push(cf);
  });
  o[f3]=mkFrame(f3,"Pipeline",sx,0,1400,900,"#0f172a",ROOT,[sb,hd,...colIds]);
  return {id:f3,objects:o};
}

async function main(){
  // Delete old file
  await q("DELETE FROM files WHERE project_id = $1",[PID]);
  
  const pageId=uid();
  const d=buildDashboard(),c=buildContacts(),p=buildPipeline();
  const allObj={[ROOT]:{id:ROOT,name:"Root Frame",type:"frame",x:0,y:0,width:0,height:0,fills:[],strokes:[],opacity:1,rotation:0,shapes:[d.id,c.id,p.id],frameId:ROOT,parentId:null},...d.objects,...c.objects,...p.objects};
  // Add interactions between screens
  allObj[d.id].interactions=[{id:uid(),eventType:"click",actionType:"navigate",destination:c.id}];
  
  const fileData={pages:[pageId],colors:{},components:{},pagesIndex:{[pageId]:{id:pageId,name:"Page 1",flows:[],objects:allObj}},typographies:{}};
  const fileId=uid();
  await q("INSERT INTO files (id,project_id,name,data,revn) VALUES ($1,$2,$3,$4::jsonb,1)",[fileId,PID,"CRM Design",JSON.stringify(fileData)]);
  
  // Runtime schema with database, state, actions, workflows
  const schema = {
    id:PID, name:"CRM Dashboard", version:"1.0.0", schemaVersion:1,
    theme:{colors:{primary:"#818cf8",secondary:"#6366f1",background:"#0f172a",surface:"#1e293b",text:"#f1f5f9",textSecondary:"#94a3b8",error:"#ef4444",success:"#34d399",warning:"#fbbf24"},fonts:{heading:"Inter",body:"Inter",mono:"JetBrains Mono"},spacing:{xs:4,sm:8,md:16,lg:24,xl:32,xxl:48},radii:{sm:4,md:8,lg:12,xl:16,full:9999},shadows:{}},
    screens:[
      {id:d.id,name:"Dashboard",route:"/dashboard",components:[],localState:[{id:"s1",name:"stats",type:"object",defaultValue:{revenue:"$284,500",deals:147,leads:63,winRate:"72%"}}],actions:[{id:"a1",name:"refreshStats",type:"api",config:{method:"GET",url:"/api/crm/stats"}}]},
      {id:c.id,name:"Contacts",route:"/contacts",components:[],localState:[{id:"s2",name:"contacts",type:"array",defaultValue:[]}],actions:[{id:"a2",name:"fetchContacts",type:"api",config:{method:"GET",url:"/api/crm/contacts"}},{id:"a3",name:"addContact",type:"api",config:{method:"POST",url:"/api/crm/contacts"}}]},
      {id:p.id,name:"Pipeline",route:"/pipeline",components:[],localState:[{id:"s3",name:"deals",type:"array",defaultValue:[]}],actions:[{id:"a4",name:"fetchDeals",type:"api",config:{method:"GET",url:"/api/crm/deals"}},{id:"a5",name:"updateDealStage",type:"api",config:{method:"PATCH",url:"/api/crm/deals/:id"}}]}
    ],
    globalState:[
      {id:"gs1",name:"currentUser",type:"object",defaultValue:{name:"",email:"",role:"admin"}},
      {id:"gs2",name:"searchQuery",type:"string",defaultValue:""},
      {id:"gs3",name:"notifications",type:"array",defaultValue:[]}
    ],
    globalActions:[
      {id:"ga1",name:"login",type:"api",config:{method:"POST",url:"/api/auth/login"}},
      {id:"ga2",name:"logout",type:"api",config:{method:"POST",url:"/api/auth/logout"}},
      {id:"ga3",name:"showToast",type:"setState",config:{target:"notifications",operation:"append"}}
    ],
    workflows:[
      {id:"wf1",name:"Deal Lifecycle",trigger:"manual",nodes:[
        {id:"wn1",type:"trigger",label:"New Lead Created",x:0,y:0,config:{}},
        {id:"wn2",type:"condition",label:"Lead Score > 50?",x:200,y:0,config:{expression:"$lead.score > 50"}},
        {id:"wn3",type:"action",label:"Qualify Lead",x:400,y:-80,config:{actionId:"qualifyLead"}},
        {id:"wn4",type:"action",label:"Send Nurture Email",x:400,y:80,config:{actionId:"sendEmail"}},
        {id:"wn5",type:"action",label:"Create Deal",x:600,y:-80,config:{actionId:"createDeal"}}
      ],edges:[
        {id:"we1",from:"wn1",to:"wn2",label:""},
        {id:"we2",from:"wn2",to:"wn3",label:"Yes"},
        {id:"we3",from:"wn2",to:"wn4",label:"No"},
        {id:"we4",from:"wn3",to:"wn5",label:""}
      ]},
      {id:"wf2",name:"Deal Won Notification",trigger:"event",nodes:[
        {id:"wn6",type:"trigger",label:"Deal Stage → Won",x:0,y:0,config:{event:"deal.stageChanged",condition:"stage === 'won'"}},
        {id:"wn7",type:"action",label:"Send Slack Alert",x:200,y:0,config:{actionId:"slackNotify"}},
        {id:"wn8",type:"action",label:"Update Revenue",x:400,y:0,config:{actionId:"updateRevenue"}}
      ],edges:[{id:"we5",from:"wn6",to:"wn7",label:""},{id:"we6",from:"wn7",to:"wn8",label:""}]}
    ],
    navigation:{type:"stack",initialRoute:"/dashboard",routes:[{path:"/dashboard",screenId:d.id},{path:"/contacts",screenId:c.id},{path:"/pipeline",screenId:p.id}]},
    database:{provider:"mint",tables:[
      {id:"t1",name:"contacts",fields:[
        {name:"id",type:"uuid",primaryKey:true,required:true},
        {name:"name",type:"text",required:true},{name:"email",type:"text",required:true,unique:true},
        {name:"company",type:"text"},{name:"phone",type:"text"},{name:"status",type:"text",defaultValue:"lead"},
        {name:"source",type:"text"},{name:"created_at",type:"timestamp",defaultValue:"now()"},
        {name:"owner_id",type:"uuid",references:"users.id"}
      ]},
      {id:"t2",name:"deals",fields:[
        {name:"id",type:"uuid",primaryKey:true,required:true},
        {name:"name",type:"text",required:true},{name:"value",type:"number",defaultValue:0},
        {name:"stage",type:"text",defaultValue:"new_lead"},
        {name:"contact_id",type:"uuid",references:"contacts.id"},
        {name:"probability",type:"number",defaultValue:0},{name:"expected_close",type:"date"},
        {name:"created_at",type:"timestamp",defaultValue:"now()"},
        {name:"owner_id",type:"uuid",references:"users.id"}
      ]},
      {id:"t3",name:"activities",fields:[
        {name:"id",type:"uuid",primaryKey:true,required:true},
        {name:"type",type:"text",required:true},{name:"description",type:"text"},
        {name:"contact_id",type:"uuid",references:"contacts.id"},
        {name:"deal_id",type:"uuid",references:"deals.id"},
        {name:"created_at",type:"timestamp",defaultValue:"now()"},
        {name:"user_id",type:"uuid",references:"users.id"}
      ]},
      {id:"t4",name:"notes",fields:[
        {name:"id",type:"uuid",primaryKey:true,required:true},
        {name:"content",type:"text",required:true},
        {name:"contact_id",type:"uuid",references:"contacts.id"},
        {name:"deal_id",type:"uuid",references:"deals.id"},
        {name:"created_at",type:"timestamp",defaultValue:"now()"}
      ]}
    ]},
    auth:{enabled:true,provider:"email",roles:["admin","sales_rep","manager"],defaultRole:"sales_rep"}
  };

  await q("INSERT INTO runtime_schemas (project_id,schema_json,updated_by) VALUES ($1,$2::jsonb,$3) ON CONFLICT (project_id) DO UPDATE SET schema_json=$2::jsonb, updated_at=NOW()",[PID,JSON.stringify(schema),"4a3114bc-d622-4cf6-afe6-2c251b563091"]);

  console.log("✅ CRM Dashboard seeded with 3 screens + runtime schema (DB tables, state, actions, workflows)");
}
main().catch(console.error);
