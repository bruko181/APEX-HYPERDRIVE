/* APEX / HYPERDRIVE — original self-contained WebGL2 3D engine.
   No external JavaScript dependency. True 3D geometry with z-buffer, normals, perspective camera.
   Science model: planar loop, I=m r^2 thin-hoop approximation, F_net = (M + 4I/r^2)a.
 */
'use strict';
(()=>{
 const $=id=>document.getElementById(id),canvas=$('screen'),gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance',depth:true});
 if(!gl){$('bootError').classList.remove('hidden');$('bootError').textContent='This device/browser cannot start WebGL2. Try an updated Chrome, Edge, or Safari with graphics acceleration enabled.';return;}
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('bootError').textContent='The graphics context was interrupted. Reopen or reload this game to restore its 3D engine.';$('bootError').classList.remove('hidden');});
 canvas.addEventListener('webglcontextrestored',()=>location.reload());
 const PI=Math.PI,TAU=2*PI,clamp=(v,l,h)=>Math.max(l,Math.min(h,v)),mod=(x,n)=>((x%n)+n)%n,lerp=(a,b,t)=>a+(b-a)*t;
 let seed=735924;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
 const V=(x=0,y=0,z=0)=>[x,y,z],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,n)=>[a[0]*n,a[1]*n,a[2]*n],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),norm=a=>mul(a,1/(len(a)||1));
 const hex=s=>{if(Array.isArray(s))return s;let c=s.replace('#','');let n=parseInt(c,16);return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]};
 const orthoModel=(pos,tangent)=>{const t=norm(tangent),r=norm([-t[2],0,t[0]]),b=mul(t,-1);return new Float32Array([r[0],r[1],r[2],0,0,1,0,0,b[0],b[1],b[2],0,pos[0],pos[1],pos[2],1])};
 const ID=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 const perspective=(fov,aspect,near,far)=>{const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0])};
 const lookAt=(eye,target)=>{const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1])};
 const vs=`#version 300 es
 precision highp float;layout(location=0)in vec3 p;layout(location=1)in vec3 n;layout(location=2)in vec3 color;layout(location=3)in float emission;
 uniform mat4 projection,view,model;out vec3 vColor,vNormal,vWorld;out float vEmission;
 void main(){vec4 w=model*vec4(p,1.0);vWorld=w.xyz;vNormal=mat3(model)*n;vColor=color;vEmission=emission;gl_Position=projection*view*w;}`;
 const fs=`#version 300 es
 precision highp float;in vec3 vColor,vNormal,vWorld;in float vEmission;uniform vec3 cameraPos;uniform float night;out vec4 outColor;
 void main(){vec3 N=normalize(vNormal);vec3 L=normalize(vec3(-0.50,0.82,0.36));float d=max(0.,dot(N,L));
 vec3 base=vColor*(0.29+0.66*d);vec3 V=normalize(cameraPos-vWorld);vec3 H=normalize(L+V);float spec=pow(max(0.,dot(N,H)),28.0)*.25;
 base+=vec3(.68,.86,1.)*spec;float fres=pow(1.-max(dot(N,V),0.),3.);base+=vec3(.08,.14,.22)*fres;vec3 c=mix(base,vColor*1.30,clamp(vEmission,0.,1.));
 float fog=smoothstep(120.,760.,distance(cameraPos,vWorld));c=mix(c,vec3(.042,.057,.116),fog*.79);outColor=vec4(c,1.);}`;
 const skyVs=`#version 300 es
 precision highp float;out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
 const skyFs=`#version 300 es
 precision highp float;in vec2 uv;uniform float time;out vec4 outColor;
 float rand(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 void main(){float y=uv.y;vec3 top=vec3(.018,.030,.09);vec3 mid=vec3(.13,.095,.25);vec3 low=vec3(.30,.13,.30);vec3 c=mix(low,mid,smoothstep(.15,.62,y));c=mix(c,top,smoothstep(.55,1.,y));
 float sun=length((uv-vec2(.73,.40))*vec2(1.7,2.3));c+=vec3(.50,.14,.30)*exp(-sun*9.)*.44;
 float star=step(.9987,rand(floor(uv*vec2(650.,380.))));c+=vec3(.52,.73,1.)*star*smoothstep(.28,.75,y)*.5;
 outColor=vec4(c,1.);}`;
 const texVs=`#version 300 es
 precision highp float;layout(location=0)in vec3 pos;layout(location=1)in vec2 uv;uniform mat4 projection,view,model;out vec2 t;void main(){gl_Position=projection*view*model*vec4(pos,1.);t=uv;}`;
 const texFs=`#version 300 es
 precision highp float;in vec2 t;uniform sampler2D decal;out vec4 outColor;void main(){vec4 c=texture(decal,t);if(c.a<.03)discard;outColor=vec4(c.rgb,1.);}`;
 function program(v,f){const compile=(type,src)=>{let sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh};const pr=gl.createProgram();gl.attachShader(pr,compile(gl.VERTEX_SHADER,v));gl.attachShader(pr,compile(gl.FRAGMENT_SHADER,f));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pr));return pr;}
 let shader,skyShader,texShader;
 try{shader=program(vs,fs);skyShader=program(skyVs,skyFs);texShader=program(texVs,texFs);}catch(e){$('bootError').textContent='3D shader startup failed: '+e.message;$('bootError').classList.remove('hidden');return;}
 const shU={p:gl.getUniformLocation(shader,'projection'),v:gl.getUniformLocation(shader,'view'),m:gl.getUniformLocation(shader,'model'),eye:gl.getUniformLocation(shader,'cameraPos')};
 const skyU={time:gl.getUniformLocation(skyShader,'time')};const texU={p:gl.getUniformLocation(texShader,'projection'),v:gl.getUniformLocation(texShader,'view'),m:gl.getUniformLocation(texShader,'model'),d:gl.getUniformLocation(texShader,'decal')};
 class Builder{
  constructor(){this.v=[];this.idx=[];}
  quad(a,b,c,d,col,em=0){const color=hex(col),na=norm(cross(sub(b,a),sub(c,a))),start=this.v.length/10;
   for(const p of[a,b,c,d])this.v.push(...p,...na,...color,em);this.idx.push(start,start+1,start+2,start,start+2,start+3);}
  box(x,y,z,w,h,d,col,em=0){let x0=x-w/2,x1=x+w/2,y0=y,y1=y+h,z0=z-d/2,z1=z+d/2;this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],col,em);this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],col,em);this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],col,em);this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],col,em);this.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],col,em);}
  tri(a,b,c,col,em=0){this.quad(a,b,c,c,col,em)}
  strip(segA,segB,col,em=0){this.quad(segA[0],segA[1],segB[1],segB[0],col,em)}
  cylinderX(cx,cy,cz,r,length,color,sides=12){for(let i=0;i<sides;i++){const a=i*TAU/sides,b=(i+1)*TAU/sides;
   let p0=[cx-length/2,cy+Math.cos(a)*r,cz+Math.sin(a)*r],p1=[cx+length/2,cy+Math.cos(a)*r,cz+Math.sin(a)*r],p2=[cx+length/2,cy+Math.cos(b)*r,cz+Math.sin(b)*r],p3=[cx-length/2,cy+Math.cos(b)*r,cz+Math.sin(b)*r];this.quad(p0,p1,p2,p3,color);
  }}
  gpu(){let vao=gl.createVertexArray();gl.bindVertexArray(vao);let buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(this.v),gl.STATIC_DRAW);let ebo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ebo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(this.idx),gl.STATIC_DRAW);const stride=10*4;gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,stride,3*4);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.FLOAT,false,stride,6*4);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,1,gl.FLOAT,false,stride,9*4);gl.bindVertexArray(null);return{vao,count:this.idx.length,vertices:this.v.length/10};}
 }
 function drawMesh(mesh,model){gl.bindVertexArray(mesh.vao);gl.uniformMatrix4fv(shU.m,false,model);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_INT,0);}
 // One continuously sampled, closed centerline, with no periodic scenery regeneration.
 const controls=[[0,530],[0,100],[35,-280],[230,-590],[520,-820],[910,-770],[1270,-510],[1350,-100],[1200,280],[820,500],[430,550],[50,770],[-340,720],[-610,460],[-550,120],[-240,-130]];
 const spline=(a,b,c,d,t)=>{const tt=t*t,ttt=tt*t;return [0.5*((2*b[0])+(-a[0]+c[0])*t+(2*a[0]-5*b[0]+4*c[0]-d[0])*tt+(-a[0]+3*b[0]-3*c[0]+d[0])*ttt),0,0.5*((2*b[1])+(-a[1]+c[1])*t+(2*a[1]-5*b[1]+4*c[1]-d[1])*tt+(-a[1]+3*b[1]-3*c[1]+d[1])*ttt)]};
 const raw=[];for(let i=0;i<controls.length;i++)for(let j=0;j<100;j++)raw.push(spline(controls[mod(i-1,controls.length)],controls[i],controls[(i+1)%controls.length],controls[(i+2)%controls.length],j/100));
 let L=0;const arcs=[0];for(let i=0;i<raw.length;i++){L+=len(sub(raw[(i+1)%raw.length],raw[i]));arcs.push(L)};
 function sample(s){const n=mod(s,L);let lo=0,hi=raw.length-1;while(lo<hi){let mid=(lo+hi+1)>>1;if(arcs[mid]<=n)lo=mid;else hi=mid-1;}const t=(n-arcs[lo])/(arcs[lo+1]-arcs[lo]||1);return add(mul(raw[lo],1-t),mul(raw[(lo+1)%raw.length],t));}
 function track(s){const p=sample(s),tan=norm(sub(sample(s+2),sample(s-2))),right=norm([-tan[2],0,tan[0]]);return{p,tan,right}};
 function at(s,offset=0,y=0){const t=track(s);return add(add(t.p,mul(t.right,offset)),[0,y,0]);}
 function curvature(s){const a=track(s-10).tan,b=track(s+10).tan;const dd=clamp(dot(a,b),-1,1);return Math.acos(dd)/20;}
 // Scene meshes: emissive accents, batched facade geometry and geometric road surface.
 const groundB=new Builder(),roadB=new Builder(),buildB=new Builder(),streetB=new Builder(),decorB=new Builder();
 groundB.box(270,-.4,-20,5400,.32,4800,'#142038');
 const sections=Math.ceil(L/4);const ds=L/sections;
 for(let i=0;i<sections;i++){
  const s=i*ds,e=(i+1)*ds;
  const strip=(a,b,col,em=0,batch=roadB,h=.065)=>batch.quad(at(s,a,h),at(s,b,h),at(e,b,h),at(e,a,h),col,em);
  strip(-29,29,'#17253a',0,groundB,-.06);strip(-16,16,'#202c40',0,roadB,.012);strip(-12.4,12.4,'#28313f',0,roadB,.035);
  strip(-12.9,-12.42,i%8<4?'#df647a':'#eceef6',.12);strip(12.42,12.9,i%8<4?'#df647a':'#eceef6',.12);
  strip(-13.1,-12.95,'#ff4f8c',1);strip(12.95,13.1,'#64e4ff',1);
  if(i%5<3){strip(-4.16,-4.00,'#c9d5e3',.28);strip(4.00,4.16,'#c9d5e3',.28)}
  if(i%14===0){for(const side of[-1,1]){let x=side*16.4;streetB.box(at(s,x,-.18)[0],.10,at(s,x,-.18)[2],.25,.20,.25,side>0?'#74f3ff':'#fc7da6',1);}}
  if(i%26===0){for(const side of[-1,1]){let base=at(s,side*17.7);streetB.box(base[0],0,base[2],.2,9,.2,'#6b8ba7');streetB.box(base[0],9,base[2],2,.26,.22,side>0?'#89eafe':'#ff789e',1);}}
 }
 // periodic structural bridge arches + holographic color frames, actual 3D geometry
 for(let s=210;s<L;s+=420){const t=track(s),r=t.right;
  const posts=[-18.5,18.5];for(let k of posts){let p=at(s,k);streetB.box(p[0],0,p[2],.45,12.8,.45,'#4b7195');streetB.box(p[0],12.3,p[2],.8,.4,.8,'#62e9ff',1)}
  for(let j=-11;j<=11;j++){let p=at(s,j*1.6,12.65);streetB.box(p[0],12.6,p[2],1.75,.25,.65,j%2?'#ff638d':'#68dfff',1)}
 }
 const trackSamples=[];for(let s0=0;s0<L;s0+=12)trackSamples.push(sample(s0));
 const towerClear=(x,z,w,d,pad=17)=>{for(const q of trackSamples){const dx=Math.max(Math.abs(q[0]-x)-w*.5,0),dz=Math.max(Math.abs(q[2]-z)-d*.5,0);if(dx*dx+dz*dz<(12.4+pad)**2)return false;}return true;};
 const sectorCount=24,buildingGroups=Array.from({length:sectorCount},()=>new Builder()),sectorBounds=Array.from({length:sectorCount},()=>({minx:Infinity,maxx:-Infinity,minz:Infinity,maxz:-Infinity}));
 const palettes=['#263b65','#1e3564','#354471','#28355a','#384f76','#213a62','#1a345c'];
 const addTower=(s,side,dist,h,w,d,variant)=>{
   let p=at(s,side*dist),x=p[0],z=p[2];const c=palettes[variant%palettes.length];
   if(!towerClear(x,z,w,d,13))return;const sector=Math.min(sectorCount-1,Math.floor(mod(s,L)/L*sectorCount)),b=buildingGroups[sector],bounds=sectorBounds[sector];bounds.minx=Math.min(bounds.minx,x-w);bounds.maxx=Math.max(bounds.maxx,x+w);bounds.minz=Math.min(bounds.minz,z-d);bounds.maxz=Math.max(bounds.maxz,z+d);b.box(x,0,z,w,h*.76,d,c);
   b.box(x,h*.76,z,w*.76,h*.22,d*.76,palettes[(variant+2)%palettes.length]);
   b.box(x,h*.98,z,w*.44,h*.045,d*.48,'#5b85aa');
   if(variant%4===0){b.box(x,h*1.025,z,w*.07,h*.18,d*.07,'#3c5c8b');b.box(x,h*1.205,z,w*.10,.5,d*.10,'#83eaff',1)}
   if(variant%3===0)b.box(x,h*.28,z+d*.52,w*.72,h*.032,.23,'#f85ca3',1);
   if(variant%3===1)b.box(x,h*.54,z+d*.52,w*.7,h*.025,.23,'#60dbff',1);
   const rows=Math.min(22,Math.floor(h/7)),cols=Math.min(8,Math.floor(w/3.4));
   for(let row=1;row<rows;row++)for(let col=0;col<cols;col++){
     if((row*3+col*7+variant)%5===0)continue;
     const px=x-w*.41+(col+.5)*(w*.82/cols),yy=2.4+row*h*.73/rows;
     const cw=Math.min(1.9,w*.70/cols),ch=1.5;
     const tint=(row+col+variant)%10;
     const glass=tint<4?'#8ceaff':tint<6?'#ff89b6':tint<8?'#f3d29a':'#5076ae';
     b.quad([px-cw/2,yy,z+d*.53],[px+cw/2,yy,z+d*.53],[px+cw/2,yy+ch,z+d*.53],[px-cw/2,yy+ch,z+d*.53],glass,.6);
     b.quad([x+w*.53,yy,z-d*.37+(col+.5)*d*.74/cols],[x+w*.53,yy,z-d*.37+(col+.5)*d*.74/cols+cw],[x+w*.53,yy+ch,z-d*.37+(col+.5)*d*.74/cols+cw],[x+w*.53,yy+ch,z-d*.37+(col+.5)*d*.74/cols],glass,.6);
   }
   if(variant%5===0){b.box(x+w*.51,4,z,.3,10,d*.3,'#f475ba',1);}
 };
 for(let s=0;s<L;s+=59){for(const side of[-1,1]){let variant=Math.floor(random()*20),dist=42+random()*37,height=35+random()*78;
   addTower(s,side,dist,height,12+random()*18,15+random()*24,variant);
   if(random()>.52)addTower(s+12,side,dist+28+random()*12,height*.65+40,10+random()*20,16+random()*20,(variant+5)%20);
 }}
 for(let s=32;s<L;s+=170){for(const side of[-1,1]){
  let p=at(s,side*25),a=at(s,side*27,0),b=at(s,side*27,8);streetB.box(p[0],0,p[2],.4,8,.4,'#6a8aaf');streetB.box(b[0],8,b[2],6,1.8,.75,side>0?'#1d446e':'#533a7d');streetB.box(b[0],8.1,b[2]+.45,5.2,.35,.09,side>0?'#88eeff':'#ffa3cc',1);
 }}
 // distant skyline backed by simple towers and antennae; fixed for whole loop.
 for(let i=0;i<115;i++){let x=-740+random()*2700,z=-1150+random()*2600;const w=18+random()*38,h=65+random()*115,d=20+random()*50;
   if(!towerClear(x,z,w,d,25))continue;decorB.box(x,-1,z,w,h,d,palettes[i%palettes.length]);}
 const ground=groundB.gpu(),road=roadB.gpu(),buildings=buildB.gpu(),buildingMeshes=buildingGroups.map((b,i)=>({mesh:b.gpu(),bounds:sectorBounds[i]})),street=streetB.gpu(),decor=decorB.gpu();
 // Sculpted, fully three-dimensional vehicle built from multiple body rings and glass faces.
 function makeCar(paint){const b=new Builder();
  // Bugatti-inspired hypercar silhouette: wide body, horseshoe grille, C-line side accent, full-width rear bar.
  b.box(0,.34,.08,2.28,.24,4.62,'#0f1523');
  const rings=[
    {z:-2.28,y0:.40,y1:.92,w:.70},
    {z:-1.86,y0:.39,y1:1.06,w:.94},
    {z:-1.10,y0:.39,y1:1.18,w:1.10},
    {z:-.15,y0:.40,y1:1.24,w:1.16},
    {z:.88,y0:.41,y1:1.22,w:1.18},
    {z:1.70,y0:.42,y1:1.06,w:1.12},
    {z:2.26,y0:.47,y1:.84,w:.92}
  ];
  for(let i=0;i<rings.length-1;i++){
    const a=rings[i],c=rings[i+1],color=paint;
    b.quad([-a.w,a.y1,a.z],[a.w,a.y1,a.z],[c.w,c.y1,c.z],[-c.w,c.y1,c.z],color);
    b.quad([-a.w,a.y0,a.z],[-a.w,a.y1,a.z],[-c.w,c.y1,c.z],[-c.w,c.y0,c.z],color);
    b.quad([a.w,a.y1,a.z],[a.w,a.y0,a.z],[c.w,c.y0,c.z],[c.w,c.y1,c.z],color);
  }
  // lower rocker + stronger side haunches
  b.box(0,.56,.18,2.12,.30,3.88,paint);
  b.box(-1.08,.52,.15,.16,.18,3.02,'#121826');
  b.box(1.08,.52,.15,.16,.18,3.02,'#121826');

  // canopy and roof
  b.quad([-.76,1.18,-.95],[.76,1.18,-.95],[.62,1.92,-.20],[-.62,1.92,-.20],'#274868');
  b.quad([-.62,1.92,-.20],[.62,1.92,-.20],[.55,1.88,.86],[-.55,1.88,.86],'#36597b');
  b.quad([-.55,1.88,.86],[.55,1.88,.86],[.83,1.16,1.28],[-.83,1.16,1.28],'#17314f');
  b.quad([-.76,1.18,-.95],[-.62,1.92,-.20],[-.55,1.88,.86],[-.83,1.16,1.28],'#233a59');
  b.quad([.62,1.92,-.20],[.76,1.18,-.95],[.83,1.16,1.28],[.55,1.88,.86],'#223855');
  // signature center spine
  b.box(0,1.08,-.92,.10,.19,1.88,'#cad4df');
  b.box(0,1.86,.32,.10,.07,1.05,'#cad4df');

  // front Bugatti-style horseshoe grille and headlamps
  b.box(0,.69,-2.25,1.02,.56,.10,'#080b12');
  b.box(0,.69,-2.20,.74,.40,.06,'#161e2b');
  b.box(0,.84,-2.15,.18,.13,.05,'#a3213d',.50);
  b.box(-.72,.90,-2.07,.46,.10,.16,'#d9f1ff',1); b.box(.72,.90,-2.07,.46,.10,.16,'#d9f1ff',1);
  b.box(-.42,.86,-2.10,.22,.08,.08,'#79dbff',.85); b.box(.42,.86,-2.10,.22,.08,.08,'#79dbff',.85);
  b.box(0,.42,-2.28,2.30,.09,.22,'#0a0f18');

  // side Bugatti C-line accent (stylized)
  b.box(-.92,1.00,.06,.08,.86,2.52,'#dce4ec');
  b.box(-.64,1.42,.82,.42,.08,.16,'#dce4ec');
  b.box(.92,1.00,.06,.08,.86,2.52,'#dce4ec');
  b.box(.64,1.42,.82,.42,.08,.16,'#dce4ec');

  // rear light bar and diffuser
  b.box(0,.95,2.30,1.94,.12,.11,'#ff356c',1);
  b.box(0,.82,2.18,2.08,.14,.08,'#7ce0ff',.20);
  b.box(-.86,.89,2.23,.18,.18,.08,'#ff7d9b',1); b.box(.86,.89,2.23,.18,.18,.08,'#ff7d9b',1);
  b.box(0,.45,2.36,2.05,.18,.20,'#0f121b');
  b.box(-.58,.53,2.43,.26,.12,.10,'#97a7bb'); b.box(.58,.53,2.43,.26,.12,.10,'#97a7bb');
  // rear wing
  b.box(-.80,1.07,1.65,.13,.38,.12,'#151b28'); b.box(.80,1.07,1.65,.13,.38,.12,'#151b28');
  b.box(0,1.43,1.72,2.34,.14,.44,'#1c2332'); b.box(0,1.52,1.57,2.08,.034,.08,'#8be9ff',.50);

  // underglow and exhaust details
  b.box(0,.36,.14,1.28,.06,3.36,'#2cd0ff',.42);
  b.box(-.50,.55,2.37,.20,.11,.09,'#d8e2ec'); b.box(.50,.55,2.37,.20,.11,.09,'#d8e2ec');

  // Animated wheels are rendered as independently transformed 3D meshes below.
  return b.gpu();
 }

 function makeWheel(){const b=new Builder();b.cylinderX(0,0,0,.51,.34,'#12161e',18);b.cylinderX(.19,0,0,.35,.07,'#9bb6cc',18);b.cylinderX(-.19,0,0,.35,.07,'#9bb6cc',18);b.cylinderX(.24,0,0,.17,.055,'#24354b',12);b.cylinderX(-.24,0,0,.17,.055,'#24354b',12);
  for(let k=0;k<7;k++){let a=k*TAU/7;b.box(0,Math.cos(a)*.23,Math.sin(a)*.23,.37,.075,.075,'#d1e3f5');}
  return b.gpu();}
 const wheelMesh=makeWheel();
 function matmul(a,b){const c=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)c[j*4+i]+=a[k*4+i]*b[j*4+k];return c;}
 function wheelTransform(body,x,y,z,angle,steer=0){const c=Math.cos(angle),s=Math.sin(angle),cy=Math.cos(steer),sy=Math.sin(steer);
  // local wheel: spin about x, front steering about y
  const local=new Float32Array([cy,0,-sy,0,sy*s,c,cy*s,0,sy*c,-s,cy*c,0,x,y,z,1]);
  return matmul(body,local);
 }
 function drawWheels(body,theta,steering=0){for(const axle of [{z:-1.34,steer:steering},{z:1.38,steer:0}])for(const side of[-1,1])drawMesh(wheelMesh,wheelTransform(body,side*1.11,.48,axle.z,theta,axle.steer));}
 function makeContactShadow(){const b=new Builder();b.quad([-1.18,0,-2.35],[1.18,0,-2.35],[1.34,0,2.34],[-1.34,0,2.34],'#0d1221');return b.gpu();}
 const shadowMesh=makeContactShadow();
 const carPaints=['#f54764','#39b7fe','#f0f4ff','#efbe63','#ae72ff'],playerMeshes=Object.fromEntries(carPaints.map(p=>[p,makeCar(p)])),trafficMeshes=['#54acfc','#eacb6c','#dce8f8','#ae7cff','#ff6b8d','#40c8aa'].map(makeCar);
 const RIVAL_NAMES=['VOLT','KAI','VEX','PHANTOM','NOVA','GHOST','JETT','ZENITH','BLITZ','ONYX','RUSH','ECHO'];
 const RIVAL_STYLES=['aggressive','technical','defensive','balanced','aggressive','technical','balanced','defensive','aggressive','balanced','technical','defensive'];
 const AI=Array.from({length:12},(_,i)=>({
  id:i,name:RIVAL_NAMES[i],style:RIVAL_STYLES[i],color:i%6,
  s:0,progress:0,laps:0,lane:[-.67,0,.67][i%3],targetLane:[-.67,0,.67][i%3],
  speed:0,targetSpeed:0,topSpeed:70+(i*7%18),accel:3.8+(i*3%5)*.45,
  brakes:8+(i%4)*1.3,grip:.92+(i%5)*.07,aggression:.35+(i%5)*.13,
  nitro:.75,burst:0,thought:0,defend:0,cooldown:0,lapTime:0,best:null,
  status:'GRID',passCount:0,yaw:0,spin:0,nearMisses:0
 }));
 const signedGap=(ahead,behind)=>mod(ahead-behind+L/2,L)-L/2;
 const raceRanking=()=>[...AI.map(ai=>({id:ai.id,name:ai.name,progress:ai.progress,player:false})),{id:-1,name:'YOU',progress:state.total,player:true}].sort((a,b)=>b.progress-a.progress);
 function initRivals(){AI.forEach((c,i)=>{
  const stagger=55+i*27;
  c.progress=stagger;c.s=mod(stagger,L);c.lane=[-.67,0,.67][i%3];c.targetLane=c.lane;
  c.speed=0;c.targetSpeed=c.topSpeed;c.cooldown=0;c.thought=.12*i;c.defend=0;c.burst=0;c.nitro=.7;
  c.spin=0;c.yaw=0;c.passCount=0;c.laps=0;c.lapTime=0;c.best=null;c.status='GRID';
 });}
 function corridorOpen(car,lane,dist=20){
   if(Math.abs(lane)>.77)return false;
   if(Math.abs(state.total-car.progress)<dist&&Math.abs(state.lane-lane)<.30)return false;
   for(const other of AI){if(other===car)continue;if(Math.abs(other.progress-car.progress)<dist&&Math.abs(other.lane-lane)<.33)return false;}
   return true;
 }
 function updateRivals(dt){
   // Decisions are batched (~4/s) while smooth motion runs at 120 Hz.
   for(const car of AI){
     car.cooldown=Math.max(0,car.cooldown-dt);
     car.burst=Math.max(0,car.burst-dt);
     car.defend=Math.max(0,car.defend-dt);
     car.thought-=dt;
     const corner=Math.max(curvature(car.progress+30),curvature(car.progress+65));
     const cornerLimit=Math.sqrt((car.grip*9.81)/Math.max(corner,.000035));
     // Racers can carry more speed than the player if they use good lines.
     const tacticalCap=clamp(cornerLimit*.97,31,car.topSpeed);
     let idealSpeed=Math.min(car.topSpeed,tacticalCap);
     if(car.thought<=0){
       car.thought=.20+((car.id*17)%7)*.055;
       let nearest=null,nearestDist=1e5;
       for(const other of AI){if(other===car)continue;let gap=other.progress-car.progress;
         if(gap>0&&gap<64&&Math.abs(other.lane-car.lane)<.33&&gap<nearestDist){nearest=other;nearestDist=gap;}}
       const playerGap=state.total-car.progress;
       if(playerGap>0&&playerGap<64&&Math.abs(state.lane-car.lane)<.35&&playerGap<nearestDist){nearest={speed:state.speed,lane:state.lane,name:'YOU'};nearestDist=playerGap;}
       if(nearest&&car.speed>nearest.speed+1.5){
         let lanes=[-.67,0,.67].filter(l=>Math.abs(l-car.lane)>.32&&corridorOpen(car,l,26));
         if(lanes.length){lanes.sort((a,b)=>Math.abs(a-car.lane)-Math.abs(b-car.lane));car.targetLane=lanes[0];car.status='OVERTAKE';car.passCount++;}
         else {idealSpeed=Math.min(idealSpeed,Math.max(15,nearest.speed+(nearestDist-10)*.22));car.status='DRAFT';}
       }else{
         const closeBehind=state.total<car.progress&&car.progress-state.total<38&&state.speed>car.speed+1.5;
         if(closeBehind&&car.style==='defensive'&&car.defend<=0&&corridorOpen(car,clamp(state.lane,-.67,.67),16)){
           car.targetLane=[-.67,0,.67].reduce((a,b)=>Math.abs(b-state.lane)<Math.abs(a-state.lane)?b:a);
           car.defend=2.2;car.status='DEFENDING';
         }else if(car.style==='technical'&&car.defend<=0&&!nearest){
           car.targetLane=[-.67,0,.67][Math.abs(Math.floor(car.progress/420+car.id))%3];
           if(!corridorOpen(car,car.targetLane,16))car.targetLane=car.lane;
           car.status='RACING LINE';
         }else if(car.status!=='DEFENDING'){car.status='PUSHING';}
       }
       // Aggressive drivers occasionally use a finite nitro resource to pass.
       if(car.style==='aggressive'&&car.nitro>.2&&car.burst<=0&&nearestDist<90&&nearestDist>15&&car.speed>28){
         car.burst=.8+car.aggression*.6;car.nitro=Math.max(0,car.nitro-.19);car.status=car.status==='OVERTAKE'?'BOOST PASS':'BOOSTING';
       }
     }
     let front=null,gapAhead=1e5;
     for(const other of AI){if(other===car)continue;const g=other.progress-car.progress;
       if(g>0&&g<34&&Math.abs(other.lane-car.lane)<.29&&g<gapAhead){gapAhead=g;front=other;}}
     const pg=state.total-car.progress;
     if(pg>0&&pg<34&&Math.abs(state.lane-car.lane)<.29&&pg<gapAhead){gapAhead=pg;front={speed:state.speed};}
     if(front){const safe=5+Math.max(0,car.speed-front.speed)*.85;
       if(gapAhead<safe+16)idealSpeed=Math.min(idealSpeed,Math.max(11,front.speed+Math.max(-11,(gapAhead-safe)*.34)));
     }
     car.targetSpeed=idealSpeed;
     const desireLane=clamp(car.targetLane,-.72,.72),oldLane=car.lane;
     const maxLaneRate=(.36+car.aggression*.13)*dt;
     car.lane+=clamp(desireLane-car.lane,-maxLaneRate,maxLaneRate);
     car.yaw=clamp((car.lane-oldLane)*4,-.13,.13);
     const boost=car.burst>0?4.8:0;
     if(car.speed<idealSpeed){car.speed=Math.min(idealSpeed,car.speed+(car.accel+boost)*dt);}
     else car.speed=Math.max(idealSpeed,car.speed-car.brakes*dt);
     car.speed=clamp(car.speed,0,car.topSpeed+7);
     const prev=car.progress;car.progress+=car.speed*dt;car.spin+=car.speed*dt/.34;car.s=mod(car.progress,L);car.lapTime+=dt;
     if(Math.floor(car.progress/L)>Math.floor(prev/L)){car.laps++;if(car.lapTime>5)car.best=car.best===null?car.lapTime:Math.min(car.best,car.lapTime);car.lapTime=0;}
   }
 }
 initRivals();
 // Personalized 3D bonnet photo decal drawn from an actual WebGL texture.
 let decal=null;const img=new Image();img.onerror=()=>{const status=$('liveryStatus');if(status)status.textContent='DECAL FILE MISSING';};img.onload=()=>{const status=$('liveryStatus');if(status)status.textContent='LOVE LIVERY ACTIVE';decal=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,decal);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);};img.src='assets/personalized_decal.png';
 // Two readable, body-mounted decals: one follows the sloped rear window and
 // one rests above the roof panel. Unlike the old 27cm rear bumper sticker,
 // both surfaces face the chase camera. Text is part of the texture itself.
 const decalV=new Float32Array([
  // sloping rear windshield (negative to positive z is rearward)
  -.51,1.725,.79,0,1, .51,1.725,.79,1,1,
  -.70,1.20,1.23,0,0,  .70,1.20,1.23,1,0,
  // extra roof livery facing camera from high angle
  -.49,1.937,-.15,0,0, .49,1.937,-.15,1,0,
  -.49,1.931,.69,0,1,  .49,1.931,.69,1,1
 ]);
 const decalIdx=new Uint16Array([0,2,1,1,2,3,4,6,5,5,6,7]);
 const decalVao=gl.createVertexArray();gl.bindVertexArray(decalVao);let db=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,db);gl.bufferData(gl.ARRAY_BUFFER,decalV,gl.STATIC_DRAW);let de=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,de);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,decalIdx,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12);gl.bindVertexArray(null);
 const state={mode:'menu',s:0,lap:1,clock:0,best:null,total:0,speed:0,acc:0,lane:0,lateral:0,headingError:0,yawRate:0,steerInput:0,nitro:1,engine:7,brake:12,grip:1.15,radius:.34,mass:18,M:1350,omega:0,theta:0,ac:0,I:0,paint:carPaints[0],impact:0,impactDir:0,alert:'',alertTimer:0,previousPosition:undefined,graph:[],graphTimer:0};const keys={left:false,right:false,gas:false,brake:false,nitro:false};
 window.APEX={state,rivals:AI,trackLength:L,track,curvature,raceRanking,initRivals,calculatePhysics:(v0,a,t,r,m)=>{if(![v0,a,t,r,m].every(Number.isFinite)||r<=0||m<=0||t<0||v0+a*t<0)throw new RangeError('Invalid physics inputs');return {v:v0+a*t,x:v0*t+.5*a*t*t,w:(v0+a*t)/r,theta:(v0*t+.5*a*t*t)/r,I:m*r*r};},stats:()=>({maxVertexAttribs:gl.getParameter(gl.MAX_VERTEX_ATTRIBS),trackSections:sections,staticTriangles:(ground.count+road.count+buildingMeshes.reduce((sum,g)=>sum+g.mesh.count,0)+street.count+decor.count)/3})};
 function format(sec){const m=Math.floor(sec/60),s=Math.floor(sec%60),c=Math.floor((sec%1)*100);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(c).padStart(2,'0')}`}
 function clearKeys(){for(const k in keys)keys[k]=false;}
 function overlay(type){state.mode=type;$('app').dataset.mode=type;if(type!=='race')clearKeys();$('startModal').classList.toggle('hidden',type!=='menu');$('pauseModal').classList.toggle('hidden',type!=='pause');$('finishModal').classList.toggle('hidden',type!=='finish');$('garagePanel').classList.toggle('hidden',type!=='garage');$('labPanel').classList.toggle('hidden',type!=='lab');if(type!=='race')Object.keys(keys).forEach(k=>keys[k]=false);}
 let returnMode='menu',count=0;
 function start(){Object.assign(state,{s:0,lap:1,clock:0,total:0,totalTime:0,graphTimer:0,speed:0,acc:0,lane:0,lateral:0,headingError:0,yawRate:0,steerInput:0,nitro:1,omega:0,theta:0,impact:0,impactDir:0,alertTimer:0,previousPosition:undefined,graph:[],best:state.best});eyeReady=false;initRivals();eyeReady=false;clearKeys();overlay('countdown');count=3.3;$('countdown').classList.remove('hidden');}
 $('startBtn').onclick=start;$('retryBtn').onclick=start;$('pauseRestartBtn').onclick=start;$('resumeBtn').onclick=()=>overlay('race');$('continueBtn').onclick=()=>overlay('race');$('pauseBtn').onclick=()=>{if(state.mode==='race')overlay('pause');else if(state.mode==='pause')overlay('race')};
 function openPanel(which){if(state.mode==='countdown')return;returnMode=state.mode;overlay(which);if(which==='lab'){renderLab();drawGraph();}}
 $('labBtn').onclick=()=>openPanel('lab');$('menuLabBtn').onclick=()=>openPanel('lab');$('garageBtn').onclick=()=>openPanel('garage');document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>overlay(returnMode)));
 for(const [id,key,output,suffix] of [['engineInput','engine','engVal',' m/s²'],['brakeInput','brake','brakeVal',' m/s²'],['gripInput','grip','gripVal',''],['radiusInput','radius','radiusVal',' m'],['massInput','mass','massVal',' kg']]){$(id).addEventListener('input',e=>{state[key]=Number(e.target.value);state.I=state.mass*state.radius*state.radius;$(output).textContent=state[key].toFixed(key==='radius'?2:key==='grip'?2:1)+suffix;});}
 document.querySelectorAll('[data-paint]').forEach(b=>b.addEventListener('click',()=>{state.paint=b.dataset.paint;document.querySelectorAll('[data-paint]').forEach(x=>x.classList.toggle('on',x===b));}));

 // Optional synthesized engine audio; starts only after user gesture.
 let soundOn=false,audioCtx=null,engineOsc=null,engineGain=null,wasImpact=false;
 $('soundBtn').onclick=()=>{try{soundOn=!soundOn;if(soundOn){if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();engineOsc=audioCtx.createOscillator();engineGain=audioCtx.createGain();engineOsc.type='sawtooth';engineOsc.connect(engineGain);engineGain.connect(audioCtx.destination);engineGain.gain.value=0;engineOsc.start();}audioCtx.resume();}else if(engineGain&&audioCtx){engineGain.gain.setTargetAtTime(0,audioCtx.currentTime,.05);} $('soundBtn').setAttribute('aria-pressed',String(soundOn));$('soundBtn').textContent=soundOn?'♫':'♪';}catch(e){soundOn=false;$('soundBtn').textContent='♪';}};
 function updateSound(){if(!audioCtx||!engineGain||!engineOsc)return;const active=soundOn&&state.mode==='race';const now=audioCtx.currentTime;engineOsc.frequency.setTargetAtTime(65+state.speed*3.6,now,.12);engineGain.gain.setTargetAtTime(active?.004+.006*clamp(state.speed/90,0,1):0,now,.08);
  if(active&&state.impact>.7&&!wasImpact){try{const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='triangle';osc.frequency.setValueAtTime(135,now);osc.frequency.exponentialRampToValueAtTime(48,now+.22);gain.gain.setValueAtTime(.07,now);gain.gain.exponentialRampToValueAtTime(.001,now+.25);osc.connect(gain);gain.connect(audioCtx.destination);osc.start(now);osc.stop(now+.26);}catch(_){}}
  wasImpact=state.impact>.7;}
 const keyBindings={KeyW:'gas',ArrowUp:'gas',KeyS:'brake',ArrowDown:'brake',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'nitro',ShiftLeft:'nitro',ShiftRight:'nitro'};
 window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;if(e.code==='Escape'){if(state.mode==='race')overlay('pause');else if(state.mode==='pause')overlay('race');else if(state.mode==='lab'||state.mode==='garage')overlay(returnMode);return;}if(keyBindings[e.code]){keys[keyBindings[e.code]]=true;e.preventDefault();}});
 window.addEventListener('keyup',e=>{if(keyBindings[e.code]){keys[keyBindings[e.code]]=false;e.preventDefault();}});window.addEventListener('blur',()=>Object.keys(keys).forEach(k=>keys[k]=false));
 document.querySelectorAll('[data-drive]').forEach(el=>{let k=el.dataset.drive;el.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true;try{el.setPointerCapture?.(e.pointerId);}catch(_){}el.classList.add('pressed')});for(const event of['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,()=>{keys[k]=false;el.classList.remove('pressed')});});
 function calculate(v0,a,t,r,m){if(![v0,a,t,r,m].every(Number.isFinite)||r<=0||m<=0||t<0||v0+a*t<0)throw new RangeError('Invalid physics inputs');return {v:v0+a*t,x:v0*t+.5*a*t*t,w:(v0+a*t)/r,theta:(v0*t+.5*a*t*t)/r,I:m*r*r}}
 $('calculateBtn').onclick=()=>{let x=['exV','exA','exT','exR','exM'].map(k=>$(k).value.trim()===''?NaN:Number($(k).value));if(x.some(v=>!Number.isFinite(v))||x[0]<0||x[0]>110||Math.abs(x[1])>20||x[2]<0||x[2]>120||x[3]<=0||x[3]>2||x[4]<=0||x[4]>100||x[0]+x[1]*x[2]<0){$('calcError').textContent='Enter physically valid values; positive radius and mass, 0–120 s, no reversal, |a| ≤ 20 m/s².';$('calcResults').textContent='';return}$('calcError').textContent='';const a=calculate(...x);$('calcResults').innerHTML=Object.entries(a).map(([k,v])=>`<span>${{v:'FINAL VELOCITY',x:'DISPLACEMENT',w:'ANGULAR SPEED',theta:'ANGULAR DISPLACEMENT',I:'MOMENT OF INERTIA'}[k]}<b>${v.toFixed(4)} ${{v:'m/s',x:'m',w:'rad/s',theta:'rad',I:'kg·m²'}[k]}</b></span>`).join('');};
 const cases=[{inputs:[0,2,5,.32,18],manual:{v:10,x:25,w:31.25,theta:78.125,I:1.8432}},{inputs:[4,1.5,6,.28,14],manual:{v:13,x:51,w:46.4285714286,theta:182.1428571429,I:1.0976}},{inputs:[8,-1.2,4,.35,20],manual:{v:3.2,x:22.4,w:9.14285714286,theta:64,I:2.45}}];
 let passed=0;const rows=[];for(let i=0;i<cases.length;i++){const c=cases[i],out=calculate(...c.inputs);for(const k of['v','x','w','theta','I']){let pass=Math.abs(out[k]-c.manual[k])<1e-7;if(pass)passed++;rows.push(`<tr><td>${i+1}</td><td>${{v:'Final velocity (m/s)',x:'Displacement (m)',w:'Angular velocity (rad/s)',theta:'Angular displacement (rad)',I:'Moment of inertia (kg·m²)'}[k]}</td><td>${c.manual[k].toFixed(4)}</td><td>${out[k].toFixed(4)}</td><td class="${pass?'passed':''}">${pass?'PASS':'CHECK'}</td></tr>`);}}$('validationBody').innerHTML=rows.join('');$('checkCount').textContent=`${passed}/15 verified`;$('calculateBtn').click();
 function renderLab(){const vals={labV:state.speed,labA:state.acc,labS:state.total,labW:state.omega,labTheta:state.theta,labI:state.I,labC:state.ac};for(const k in vals)$(k).textContent=vals[k].toFixed(k==='labI'?3:2);}
 const gg=$('graph').getContext('2d');function drawGraph(){let w=$('graph').width,h=$('graph').height;gg.clearRect(0,0,w,h);gg.fillStyle='#0b1830';gg.fillRect(0,0,w,h);const Lx=55,B=h-35,T=20,R=w-20;gg.lineWidth=1;gg.strokeStyle='#395073';gg.font='14px Arial';gg.fillStyle='#94b3dd';for(let i=0;i<=5;i++){let y=T+(B-T)*i/5;gg.beginPath();gg.moveTo(Lx,y);gg.lineTo(R,y);gg.stroke();gg.fillText(String(100-i*20),7,y+4)}for(let i=0;i<=7;i++){let x=Lx+(R-Lx)*i/7;gg.beginPath();gg.moveTo(x,T);gg.lineTo(x,B);gg.stroke();gg.fillText(String(i*5),x-7,h-9)}gg.strokeStyle='#6fe5ff';gg.lineWidth=4;gg.beginPath();let last=state.totalTime||0;let data=state.graph;data.forEach(([t,v],i)=>{let x=Lx+(R-Lx)*clamp((t-(last-35))/35,0,1),y=B-(B-T)*clamp(v/100,0,1);if(i===0)gg.moveTo(x,y);else gg.lineTo(x,y)});gg.stroke();}
 let quality=0,scaleList=[.78,.96,1.16];const mobile=matchMedia('(max-width:800px), (pointer:coarse)').matches;if(!mobile)quality=1;const setQuality=()=>{let ratio=clamp(window.devicePixelRatio||1,1,mobile?1.35:1.5)*scaleList[quality];gl.canvas.width=Math.max(320,Math.round(innerWidth*ratio));gl.canvas.height=Math.max(240,Math.round(innerHeight*ratio));gl.viewport(0,0,gl.canvas.width,gl.canvas.height);$('qualityBtn').textContent=['ECO','STD','HD'][quality];};setQuality();window.addEventListener('resize',setQuality);$('qualityBtn').onclick=()=>{quality=(quality+1)%3;qualityManual=true;setQuality()};
 const tempEye=[0,7,0],tempTarget=[0,2,0];let eyeReady=false,first=0,lag=0,step=1/120,camFov=60,frameDt=1/60;
 function tick(dt){
  if(state.mode==='countdown'){count-=dt;$('countText').textContent=count>2.2?'3':count>1.35?'2':count>.45?'1':'GO';if(count<=0){$('countdown').classList.add('hidden');overlay('race');}return;}
  if(state.mode!=='race')return;
  const old=state.speed;state.I=state.mass*state.radius*state.radius;const effectiveMass=state.M+4*state.I/(state.radius*state.radius);
  const tractionForce=keys.gas?state.M*state.engine*(.34/state.radius)*(1-.35*state.speed/100):0;
  const brakeForce=keys.brake?state.M*state.brake:0;
  const dragForce=state.M*(.18+.011*state.speed+.00145*state.speed*state.speed);
  const burst=keys.nitro&&state.nitro>0&&state.speed>5&&!keys.brake;
  const nitroForce=burst?state.M*10.5:0;
  state.nitro=clamp(state.nitro+(burst?-.18:.034)*dt,0,1);
  const k=curvature(state.s+12),R=k>1e-5?1/k:Infinity;
  state.ac=Number.isFinite(R)?state.speed*state.speed/R:0;
  const excess=Math.max(0,state.ac-state.grip*9.81);
  let a=(tractionForce+nitroForce-brakeForce-dragForce)/effectiveMass-Math.min(13,excess*.36);
  if(Math.abs(state.lane)>1.05)a-=7;
  state.speed=clamp(state.speed+a*dt,0,burst?104:89);state.acc=(state.speed-old)/dt;
  // Assisted bicycle/track-relative dynamics: actual heading, yaw velocity, lateral displacement.
  // Grip caps lateral yaw demand; stability assist damps oversteer and drift.
  const steerCommand=(keys.right?1:0)-(keys.left?1:0);
  state.steerInput+=(steerCommand-state.steerInput)*(1-Math.exp(-dt*10));
  const t0=track(state.s),t1=track(state.s+5),tMinus=track(state.s-5);
  const signedCurvature=dot(cross(tMinus.tan,t1.tan),[0,1,0])/10;
  const followYaw=signedCurvature*state.speed;
  const gripYaw=(state.grip*9.81)/Math.max(5,state.speed);
  const commandedYaw=state.speed/3.05*Math.tan(state.steerInput*.058);
  const stabilizer=-state.headingError*2.4-state.lateral*.028;
  const yawTarget=clamp(followYaw+commandedYaw+stabilizer,-gripYaw,gripYaw);
  state.yawRate+=(yawTarget-state.yawRate)*(1-Math.exp(-dt*8.5));
  state.headingError=clamp(state.headingError+(state.yawRate-followYaw)*dt,-.66,.66);
  state.lateral+=Math.sin(state.headingError)*state.speed*dt;
  // Solid roadside guardrails with rebound and speed/impact penalties.
  if(Math.abs(state.lateral)>10.95){
    const side=Math.sign(state.lateral);
    state.lateral=side*10.95;
    if(state.speed>2&&state.impact<.12){state.impact=.75;state.impactDir=-side;state.alert='BARRIER CONTACT — SPEED LOST';state.alertTimer=1.1;}
    state.speed=Math.max(0,state.speed-(5.5+Math.abs(state.yawRate)*2)*dt-1.5*dt);
    state.headingError=-side*.04;
    state.yawRate=-side*.05;
  }
  state.lane=state.lateral/9.1;
  const distance=state.speed*Math.cos(state.headingError)*dt;
  state.s+=distance;state.total+=distance;state.theta+=distance/state.radius;
  state.clock+=dt;state.totalTime=(state.totalTime||0)+dt;
  updateRivals(dt);
  for(const ai of AI){
    const delta=ai.progress-state.total;
    // Bidirectional broad phase; colliding cars both lose speed and separate.
    if(Math.abs(delta)<3.8&&Math.abs(ai.lane-state.lane)<.29&&ai.cooldown===0){
      const side=state.lane<=ai.lane?-1:1;
      const relative=Math.abs(state.speed-ai.speed);
      const impactSpeed=clamp((state.speed+ai.speed)*.5-Math.max(4,relative*.24),9,90);
      state.speed=Math.min(state.speed,impactSpeed);
      ai.speed=Math.min(ai.speed,impactSpeed);
      state.lateral=clamp(state.lateral+side*1.12,-10.95,10.95);
      state.lane=state.lateral/9.1;
      state.headingError=clamp(state.headingError+side*.055,-.6,.6);
      state.yawRate+=side*.13;
      ai.lane=clamp(ai.lane-side*.15,-.78,.78);
      ai.targetLane=ai.lane;
      ai.cooldown=1.55;state.impact=1;state.impactDir=side;
      state.alert=`IMPACT WITH ${ai.name} · BOTH CARS SLOWED`;
      state.alertTimer=1.5;
    }
  }
  if(Math.abs(state.lane)>1.10&&state.speed>12){state.speed=Math.max(0,state.speed-9*dt);if(state.alertTimer<=0){state.alert='SIDE BARRIER — SLOW DOWN';state.alertTimer=.4;}}
  if(state.s>=L){state.s=mod(state.s,L);const finished=state.clock;state.best=state.best===null?finished:Math.min(state.best,finished);try{localStorage.setItem('apex_best_v3',String(state.best));}catch(_){ }state.clock=0;state.lap++;state.nitro=Math.min(1,state.nitro+.18);$('finishedTime').textContent=format(finished);$('finishedBest').textContent=format(state.best);$('finishPosition').textContent=String(raceRanking().findIndex(r=>r.player)+1).padStart(2,'0')+' / '+String(AI.length+1);overlay('finish');}
  state.acc=(state.speed-old)/dt;state.omega=state.speed/state.radius;state.ac=Math.abs(state.yawRate*state.speed);
  state.impact=Math.max(0,state.impact-2.8*dt);state.alertTimer=Math.max(0,state.alertTimer-dt);
  state.graphTimer+=dt;if(state.graphTimer>.13){state.graphTimer=0;state.graph.push([state.totalTime,state.speed]);while(state.graph.length&&state.totalTime-state.graph[0][0]>35)state.graph.shift()}
 }
 function draw(){const s=state.s,t=track(s),center=add(at(s,state.lane*9.1,0),[0,0,0]);const boost=keys.nitro&&state.mode==='race'&&state.nitro>0;
  const lead=10.7+state.speed*.018,hit=state.impact*state.impactDir,desiredEye=add(center,add(add(mul(t.tan,-(7.4+state.speed*.011)),[0,4.45+state.speed*.004+state.impact*.10,0]),mul(t.right,hit*.58))),desiredTarget=add(center,add(add(mul(t.tan,lead),[0,1.24,0]),mul(t.right,hit*.22)));
  if(!eyeReady){tempEye.splice(0,3,...desiredEye);tempTarget.splice(0,3,...desiredTarget);eyeReady=true;}
  let smooth=1-Math.exp(-Math.max(0,frameDt)*5.4);for(let i=0;i<3;i++){tempEye[i]=lerp(tempEye[i],desiredEye[i],smooth);tempTarget[i]=lerp(tempTarget[i],desiredTarget[i],smooth);}
  const camera=lookAt(tempEye,tempTarget),proj=perspective((camFov+(boost?3:0))*PI/180,gl.canvas.width/gl.canvas.height,.11,1600);
  gl.disable(gl.DEPTH_TEST);gl.useProgram(skyShader);gl.uniform1f(skyU.time,performance.now()*.001);gl.drawArrays(gl.TRIANGLES,0,3);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clear(gl.DEPTH_BUFFER_BIT);gl.disable(gl.CULL_FACE); // Mixed hand-modeled face windings; depth buffer handles occlusion reliably.
  gl.useProgram(shader);gl.uniformMatrix4fv(shU.p,false,proj);gl.uniformMatrix4fv(shU.v,false,camera);gl.uniform3f(shU.eye,...tempEye);
  // Cull only GPU geometry faces; no dynamic object recreation or distance-dependent regeneration.
  for(const mesh of [ground,road,street,decor])drawMesh(mesh,ID);
  // Chunked building meshes. Avoid drawing sectors entirely outside nearby fog range.
  const farDist=980;for(const g of buildingMeshes){if(!g.mesh.count)continue;const b=g.bounds;const dx=Math.max(b.minx-tempEye[0],0,tempEye[0]-b.maxx),dz=Math.max(b.minz-tempEye[2],0,tempEye[2]-b.maxz);if(dx*dx+dz*dz>farDist*farDist)continue;drawMesh(g.mesh,ID);} 
  for(const ai of AI){let t2=track(ai.s),place=at(ai.s,ai.lane*9.1,.025),direction=norm(add(t2.tan,mul(t2.right,ai.yaw))),model=orthoModel(place,direction);drawMesh(shadowMesh,orthoModel(at(ai.s,ai.lane*9.1,.09),direction));drawMesh(trafficMeshes[ai.color],model);drawWheels(model,ai.spin,ai.yaw);}
  const carForward=norm(add(mul(t.tan,Math.cos(state.headingError)),mul(t.right,Math.sin(state.headingError))));
  const model=orthoModel(add(center,[0,.04+state.impact*.025,0]),carForward);
  if(state.impact>0){const roll=state.impact*.04*state.impactDir,ca=Math.cos(roll),sa=Math.sin(roll);for(let i=0;i<3;i++){let right=model[i],up=model[4+i];model[i]=right*ca+up*sa;model[4+i]=up*ca-right*sa;}}
  drawMesh(shadowMesh,orthoModel(at(state.s,state.lane*9.1,.09),t.tan));drawMesh(playerMeshes[state.paint]||playerMeshes[carPaints[0]],model);drawWheels(model,state.theta,state.steerInput*.058);
  gl.disable(gl.CULL_FACE);
  if(decal){gl.useProgram(texShader);gl.uniformMatrix4fv(texU.p,false,proj);gl.uniformMatrix4fv(texU.v,false,camera);gl.uniformMatrix4fv(texU.m,false,model);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,decal);gl.uniform1i(texU.d,0);gl.bindVertexArray(decalVao);gl.drawElements(gl.TRIANGLES,12,gl.UNSIGNED_SHORT,0);}
 }
 function updateHud(){if(state.mode==='menu')return;
  $('speed').textContent=String(Math.round(state.speed*3.6)).padStart(3,'0');$('speedSI').textContent=state.speed.toFixed(2)+' m/s';$('gear').textContent='GEAR '+clamp(Math.floor(state.speed/14)+1,1,6);
  $('accel').textContent=state.acc.toFixed(2);$('corner').textContent=state.ac.toFixed(2);$('moment').textContent=state.I.toFixed(3);$('lap').textContent=String(state.lap).padStart(2,'0');$('lapClock').textContent=format(state.clock);$('best').textContent=state.best===null?'--:--.--':format(state.best);
  const standings=raceRanking(),position=standings.findIndex(x=>x.player)+1;
  if(state.mode==='race'&&state.total>120&&state.previousPosition!==undefined&&position!==state.previousPosition&&state.alertTimer<.5){state.alert=position<state.previousPosition?`POSITION GAINED — P${position}`:`POSITION LOST — P${position}`;state.alertTimer=1.25;}
  state.previousPosition=position;
  $('racePosition').textContent=String(position).padStart(2,'0');$('raceField').textContent=String(AI.length+1).padStart(2,'0');
  const closest=AI.reduce((best,r)=>Math.abs(r.progress-state.total)<Math.abs(best.progress-state.total)?r:best,AI[0]);
  const delta=closest.progress-state.total,range=Math.abs(delta);
  $('rivalName').textContent=closest.name;
  $('rivalStatus').textContent=closest.status;
  $('rivalGap').textContent=`${delta>=0?'+':'−'}${range.toFixed(0)} m`;
  $('leaderName').textContent=standings[0].name;
  $('trackFill').style.width=(100*state.s/L).toFixed(2)+'%';$('nitroFill').style.width=Math.round(state.nitro*100)+'%';$('nitroText').textContent=Math.round(state.nitro*100)+'%';$('toast').classList.toggle('visible',state.alertTimer>0);$('toast').textContent=state.alert;$('collisionFlash').style.opacity=(state.impact*.7).toFixed(3);$('boostLines').style.opacity=(keys.nitro&&state.mode==='race'&&state.nitro>.01?'.7':'0');
 }
 let last=0,accum=0,ui=0,lastDraw=0,slowFrames=0,qualityManual=false;function frame(now){let realDt=(now-(last||now))/1000,dt=clamp(realDt,0,.1);last=now;frameDt=dt;
  if(!qualityManual&&state.mode==='race'){slowFrames=realDt>.033?Math.min(250,slowFrames+1):Math.max(0,slowFrames-2);if(slowFrames>85&&quality>0){quality--;setQuality();slowFrames=0;}}
  accum+=dt;let times=0;while(accum>=step&&times<6){tick(step);accum-=step;times++;}if(times===6)accum=0;
  if(state.mode==='race'||state.mode==='countdown'||now-lastDraw>150){draw();lastDraw=now;}updateSound();ui+=dt;if(ui>.07){updateHud();if(state.mode==='lab'){renderLab();drawGraph();}ui=0;}requestAnimationFrame(frame);}
 try{const v=Number(localStorage.getItem('apex_best_v3'));if(Number.isFinite(v)&&v>0)state.best=v;}catch(_){ }
 state.I=state.mass*state.radius*state.radius;overlay('menu');requestAnimationFrame(frame);
})();
