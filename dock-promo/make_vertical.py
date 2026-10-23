"""Derive the 9:16 (1080x1920) pages from the 16:9 ones.

    python3 make_vertical.py            -> index-9x16.html, index-en-9x16.html

The vertical cut keeps the exact same timeline (so it reuses the 16:9 soundtrack) and only
re-lays-out the frame: stacked hook type, a taller pain scene, the Dock UI stacked top-to-bottom,
and subtitles lifted above the Reels / TikTok / Shorts bottom UI.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class Page:
    def __init__(self, text):
        self.s = text

    def rep(self, old, new, count=1):
        n = self.s.count(old)
        assert n == count, (n, old[:110])
        self.s = self.s.replace(old, new)

    def sub(self, pat, new, count=1):
        s2, n = re.subn(pat, new, self.s, flags=re.S)
        assert n == count, (n, pat[:110])
        self.s = s2


def coords(p, const, xy):
    """Rewrite the (x, y, rotation) triples of a BOOMS / FLOOD style array, keeping the words."""
    m = re.search(rf'const {const}=\[(.*?)\];', p.s)
    items = re.findall(r"\['((?:[^'\\]|\\.)*)',(-?\d+),(-?\d+),(-?\d+)\]", m.group(1))
    assert len(items) == len(xy), (const, len(items))
    body = ','.join(f"['{w}',{x},{y},{r}]" for (w, *_), (x, y, r) in zip(items, xy))
    p.s = p.s[:m.start()] + f'const {const}=[{body}];' + p.s[m.end():]


def shared(p):
    # ---- stage + overlays
    p.rep("#stage{position:relative;width:1920px;height:1080px;", "#stage{position:relative;width:1080px;height:1920px;")
    p.rep("#subs{position:absolute;left:0;right:0;bottom:46px;", "#subs{position:absolute;left:0;right:0;bottom:470px;")
    p.rep("</style>", """/* ---------- 9:16 overrides ---------- */
.hk .zh{width:max-content}
#sub{max-width:980px}
#sub .z,#sub .e{white-space:normal;text-wrap:balance}
</style>""")
    # ---- pain
    p.rep("#win{position:absolute;left:150px;top:118px;width:1210px;height:746px;", "#win{position:absolute;left:40px;top:360px;width:1000px;height:628px;")
    p.rep("#img{position:absolute;left:0;top:61px;width:1200px;height:675px;", "#img{position:absolute;left:0;top:61px;width:990px;height:557px;")
    p.rep("#img .sl{transform:scale(.9375)}", "#img .sl{transform:scale(.7734375)}")
    p.rep("transform:scale(.9375);transform-origin:0 0;opacity:0;overflow:hidden}", "transform:scale(.7734375);transform-origin:0 0;opacity:0;overflow:hidden}")
    p.rep("#selAll{position:absolute;left:-4px;top:57px;width:1208px;height:683px;", "#selAll{position:absolute;left:-4px;top:57px;width:998px;height:565px;")
    p.rep(".eye{position:absolute;width:86px;height:86px;border-radius:50%;background:#fff;border:5px solid var(--blk);margin:-43px 0 0 -43px}",
          ".eye{position:absolute;width:72px;height:72px;border-radius:50%;background:#fff;border:5px solid var(--blk);margin:-36px 0 0 -36px}")
    p.rep(".eye i{position:absolute;left:50%;top:50%;width:38px;height:38px;margin:-19px 0 0 -19px;",
          ".eye i{position:absolute;left:50%;top:50%;width:32px;height:32px;margin:-16px 0 0 -16px;")
    p.rep("#regen{position:absolute;left:182px;top:770px;", "#regen{position:absolute;left:60px;top:1030px;")
    p.rep("#can{position:absolute;left:740px;top:520px;", "#can{position:absolute;left:320px;top:1180px;")
    p.rep('<div class="bubble" id="cli1" style="left:1405px;top:150px">', '<div class="bubble" id="cli1" style="left:500px;top:178px">')
    p.rep('<div class="say" id="say" style="left:1240px;top:430px">', '<div class="say" id="say" style="left:470px;top:1010px">')
    coords(p, 'BOOMS', [(90, 560, -12), (330, 440, 9), (60, 700, -6), (400, 610, 14)])
    coords(p, 'FLOOD', [(520, 150, -8), (40, 175, 6), (600, 1180, -5), (80, 330, 10), (40, 1190, -10), (560, 520, 7),
                        (300, 1330, -14), (560, 860, 9), (60, 700, -4), (520, 1020, 12), (300, 430, -9), (80, 1010, 4)])
    p.rep("tl.fromTo('#win',{y:900,rotation:6},", "tl.fromTo('#win',{y:1600,rotation:6},")
    p.rep("tl.fromTo('#pCur',{x:1650,y:980},{x:250,y:250,", "tl.fromTo('#pCur',{x:950,y:1550},{x:115,y:480,")
    p.rep("tl.to('#pCur',{x:180,y:300,duration:.08,yoyo:true,repeat:1},P+1.0);", "tl.to('#pCur',{x:70,y:525,duration:.08,yoyo:true,repeat:1},P+1.0);")
    p.rep("tl.to('#pCur',{x:1352,y:850,duration:.26,ease:'power2.inOut'},P+1.55);", "tl.to('#pCur',{x:1030,y:978,duration:.26,ease:'power2.inOut'},P+1.55);")
    p.rep("tl.to('#pCur',{x:1720,y:960,duration:.45,ease:'power1.inOut'},P+1.85);", "tl.to('#pCur',{x:1062,y:1250,duration:.45,ease:'power1.inOut'},P+1.85);")
    p.rep("{scaleX:1.32,scaleY:1.16,skewX:-9,x:200,y:60,transformOrigin:'0% 0%',", "{scaleX:1.05,scaleY:1.42,skewX:-9,x:30,y:20,transformOrigin:'0% 0%',")
    p.rep("tl.to('#pCur',{x:1560,y:1200,duration:.35,ease:'power2.in'},P+2.36);", "tl.to('#pCur',{x:1000,y:2000,duration:.35,ease:'power2.in'},P+2.36);")
    p.rep("tl.fromTo('#eyes',{scale:0,transformOrigin:'1060px 400px'},", "tl.fromTo('#eyes',{scale:0,transformOrigin:'795px 600px'},")
    p.rep("tl.to('#pCur',{x:330,y:800,duration:.3,ease:'power2.out'},P+3.0);", "tl.to('#pCur',{x:220,y:1075,duration:.3,ease:'power2.out'},P+3.0);")
    p.rep("tl.fromTo('#can',{y:600},", "tl.fromTo('#can',{y:800},")
    p.rep("tl.to('#win',{scale:.16,rotation:280,x:205,y:130,", "tl.to('#win',{scale:.16,rotation:280,x:0,y:560,")
    p.rep("tl.to('#win',{y:420,duration:.12,ease:'power1.in'},P+4.83);", "tl.to('#win',{y:880,duration:.12,ease:'power1.in'},P+4.83);")
    p.rep("e1.style.left='1018px'; e1.style.top='392px'; e2.style.left='1110px'; e2.style.top='402px';",
          "e1.style.left='757px'; e1.style.top='597px'; e2.style.left='833px'; e2.style.top='606px';")
    p.rep("placeFlies(painFlies,t,960,600,240,90);", "placeFlies(painFlies,t,540,1270,220,80);")
    # ---- turn
    p.rep("#lockup{position:absolute;left:579px;top:350px;", "#lockup{position:absolute;left:159px;top:780px;")
    p.rep("clipPath:'polygon(702px 352px, 825px 368px, 825px 574px, 702px 590px)'", "clipPath:'polygon(282px 782px, 405px 798px, 405px 1004px, 282px 1020px)'")
    p.rep("clipPath:'polygon(0px 0px, 1920px 0px, 1920px 1080px, 0px 1080px)'", "clipPath:'polygon(0px 0px, 1080px 0px, 1080px 1920px, 0px 1920px)'")
    # ---- app: prompt, generation, grid
    p.rep(".topbar{position:absolute;left:0;top:0;width:1920px;", ".topbar{position:absolute;left:0;top:0;width:1080px;")
    p.rep("#prompt{position:absolute;left:360px;top:452px;width:1200px;height:200px;", "#prompt{position:absolute;left:60px;top:760px;width:960px;height:300px;")
    p.sub(r"(#prompt \.txt\{position:absolute;left:34px;top:62px;width:)\d+px", r"\g<1>880px")
    p.rep("#hint{position:absolute;left:360px;top:322px;width:1200px;", "#hint{position:absolute;left:60px;top:610px;width:960px;")
    p.rep("#main{position:absolute;left:72px;top:112px;width:1152px;height:648px;", "#main{position:absolute;left:40px;top:150px;width:1000px;height:562px;")
    p.rep("#main .sl{transform:scale(.9)}", "#main .sl{transform:scale(.78125)}")
    p.rep("#film{position:absolute;left:72px;top:786px;", "#film{position:absolute;left:40px;top:740px;")
    p.rep("#ops{position:absolute;left:1260px;top:112px;width:588px;height:740px;", "#ops{position:absolute;left:40px;top:830px;width:1000px;height:470px;")
    p.rep("const start=Math.max(0,n-14);", "const start=Math.max(0,n-7);")
    p.rep("#grid{position:absolute;left:118px;top:230px;width:1684px;height:560px;", "#grid{position:absolute;left:80px;top:150px;width:920px;height:1160px;")
    p.rep(".slot{position:absolute;width:400px;height:225px;", ".slot{position:absolute;width:440px;height:248px;")
    p.rep(".slot .sl{transform:scale(.3125)}", ".slot .sl{transform:scale(.34375)}")
    p.rep("const SLOT=(i)=>({x:(i%4)*428,y:Math.floor(i/4)*300});", "const SLOT=(i)=>({x:(i%2)*480,y:Math.floor(i/2)*290});")
    p.rep("lb.style.top=(p.y+240)+'px';", "lb.style.top=(p.y+258)+'px';")
    p.rep("#done{position:absolute;left:50%;top:132px;", "#done{position:absolute;left:50%;top:86px;")
    p.rep("tl.to('#main',{x:902+0,y:118,scale:400/1152,", "tl.to('#main',{x:40,y:290,scale:440/1000,")
    # ---- explode + logo callback + KPI edits (slide shown at 40,230 · scale .78125)
    p.rep("tl.to('#grid',{x:330,y:-38,scale:2.56,", "tl.to('#grid',{x:-40,y:80,scale:1000/440,")
    p.rep("#exWrap{position:absolute;left:448px;top:192px;width:1024px;height:576px;perspective:3200px;perspective-origin:400px 250px}",
          "#exWrap{position:absolute;left:40px;top:230px;width:1000px;height:562px;perspective:3000px;perspective-origin:380px 530px}")
    p.rep("transform-origin:0 0;transform:scale(.8);transform-style:preserve-3d}", "transform-origin:0 0;transform:scale(.78125);transform-style:preserve-3d}")
    p.rep("{rotationX:58,rotationZ:-16,scale:.56,x:-140,y:280,", "{rotationX:58,rotationZ:-10,scale:.66,x:-154,y:735,")
    p.rep("tl.fromTo(L,{z:0},{z:i*165,", "tl.fromTo(L,{z:0},{z:i*230,")
    p.rep("tl.to('#exRot',{rotationZ:-11,duration:1.4,ease:'sine.inOut'},X+1.3);", "tl.to('#exRot',{rotationZ:-5,duration:1.4,ease:'sine.inOut'},X+1.3);")
    p.rep("const lx=1580, ly=390+ (exLayers.length-1-i)*96;", "const lx=790, ly=r.top;")
    p.sub(r"#exCount\{position:absolute;left:\d+px;top:\d+px;", "#exCount{position:absolute;left:60px;top:168px;")
    p.rep("const X0=448+64*.8-6, Y0=192+56*.8-6, W=w*.8+12, H=h*.8+12;", "const X0=40+64*.78125-6, Y0=230+56*.78125-6, W=w*.78125+12, H=h*.78125+12;")
    p.rep("tl.fromTo('#cur',{x:1250,y:900},{x:560,y:262,", "tl.fromTo('#cur',{x:900,y:1400},{x:200,y:292,")
    p.rep("tl.to('#cur',{x:448+(64+230)*.8,y:192+(56+52)*.8,", "tl.to('#cur',{x:40+(64+230)*.78125,y:230+(56+52)*.78125,")
    p.rep("tl.to('#cur',{x:448+(64+230*1.8)*.8,y:192+(56+52*1.8)*.8,", "tl.to('#cur',{x:40+(64+230*1.8)*.78125,y:230+(56+52*1.8)*.78125,")
    p.rep('<div class="cb" id="cb1" style="left:1500px;top:150px">', '<div class="cb" id="cb1" style="left:60px;top:840px">')
    p.sub(r'<div class="cb" id="cb2" style="left:1560px;top:\d+px">', '<div class="cb" id="cb2" style="left:160px;top:990px">')
    p.rep("#kpiWrap{position:absolute;left:448px;top:192px;width:1024px;height:576px;", "#kpiWrap{position:absolute;left:40px;top:230px;width:1000px;height:562px;")
    p.rep("#kpiWrap .sl{transform:scale(.8)}", "#kpiWrap .sl{transform:scale(.78125)}")
    p.rep("const numT=[448+(kn.offsetLeft+kn.offsetWidth*.45)*.8, 192+(kn.offsetTop+kn.offsetHeight*.55)*.8];",
          "const numT=[40+(kn.offsetLeft+kn.offsetWidth*.45)*.78125, 230+(kn.offsetTop+kn.offsetHeight*.55)*.78125];")
    p.rep("const barT=[448+(kb.offsetLeft+kb.offsetWidth*.62)*.8, 192+(kb.offsetTop+kb.offsetHeight*.55)*.8];",
          "const barT=[40+(kb.offsetLeft+kb.offsetWidth*.62)*.78125, 230+(kb.offsetTop+kb.offsetHeight*.55)*.78125];")
    p.rep("const X0=448+el.offsetLeft*.8-6, Y0=192+el.offsetTop*.8-6, W=el.offsetWidth*.8+12, H=el.offsetHeight*.8+12;",
          "const X0=40+el.offsetLeft*.78125-6, Y0=230+el.offsetTop*.78125-6, W=el.offsetWidth*.78125+12, H=el.offsetHeight*.78125+12;")
    p.rep("tl.fromTo('#kpiWrap',{x:1300},", "tl.fromTo('#kpiWrap',{x:1100},")
    p.rep("tl.to('#exWrap',{x:-1300,", "tl.to('#exWrap',{x:-1100,")
    p.rep("#props{position:absolute;left:1508px;top:236px;width:372px;height:340px;", "#props{position:absolute;left:60px;top:850px;width:520px;height:330px;")
    p.rep("tl.to('#cur',{x:1500,y:900,duration:.5,ease:'power2.inOut'},K+2.8);", "tl.to('#cur',{x:950,y:1400,duration:.5,ease:'power2.inOut'},K+2.8);")
    # ---- end card wipe
    p.rep("#wipe{position:absolute;inset:0;background:#fff;clip-path:circle(0px at 960px 480px)}", "#wipe{position:absolute;inset:0;background:#fff;clip-path:circle(0px at 540px 960px)}")
    p.rep("tl.fromTo('#wipe',{clipPath:'circle(0px at 960px 480px)'},{clipPath:'circle(1300px at 960px 480px)',",
          "tl.fromTo('#wipe',{clipPath:'circle(0px at 540px 960px)'},{clipPath:'circle(2300px at 540px 960px)',")


# measure the hook words up front, then place the X marks / cursor / fly orbit from them
HOOK_MEASURE = """// measure the fitted hook words before any tween transforms them
const srs=$$('#{slab} .slab').map(e=>e.getBoundingClientRect()), gr=$('#{trash} .trash').getBoundingClientRect();
const sr={left:Math.min(...srs.map(r=>r.left)),right:Math.max(...srs.map(r=>r.right)),top:Math.min(...srs.map(r=>r.top)),bottom:Math.max(...srs.map(r=>r.bottom))}; sr.height=sr.bottom-sr.top;
[[sr.right-60,sr.top-6],[sr.right-10,sr.top+sr.height*.6],[sr.right-300,sr.bottom+20]].forEach(([x,y],i)=>{ hkX[i].style.left=x+'px'; hkX[i].style.top=y+'px'; });
HF=[(gr.left+gr.right)/2, (gr.top+gr.bottom)/2+10, gr.width*.6, gr.height*.45];
"""
FIT = """  [['#hk1',960],['#hk2',980],['#hk3',960]].forEach(([sel,maxW])=>{ $$(sel+' .zh').forEach(z=>{ const w=z.getBoundingClientRect().width;
    if(w>maxW) z.style.fontSize=(parseFloat(getComputedStyle(z).fontSize)*maxW/w)+'px'; }); });
  buildTL();"""


def zh(p):
    p.sub(r'      <div class="hk" id="hk1".*?(?=      <div id="hkX"></div>)', """      <div class="hk" id="hk1" style="top:250px;left:60px">
        <div class="zh boil" style="font-size:172px">AI 做的簡報</div>
        <div class="enl">An AI-made deck</div>
      </div>
      <div class="hk" id="hk2" style="top:560px;left:110px">
        <div class="zh" style="font-size:200px"><span class="slab boil">不能改，</span></div>
        <div class="enl">that you can't edit</div>
      </div>
      <div class="hk" id="hk3" style="top:890px;left:50px">
        <div class="zh boil" style="font-size:170px">就是</div>
        <div class="zh" style="font-size:270px"><span class="trash boil">垃圾</span><span class="boil">。</span></div>
        <div class="enl" style="font-size:48px;margin-top:4px">is garbage.</div>
      </div>
""")
    p.rep("const hkX=[[1520,372],[1640,480],[1380,590]].map(([x,y])=>{const d=document.createElement('div');d.className='xmark';d.innerHTML=XSVG;d.style.left=x+'px';d.style.top=y+'px';$('#hkX').appendChild(d);return d;});",
          "const hkX=[0,1,2].map(()=>{const d=document.createElement('div');d.className='xmark';d.innerHTML=XSVG;$('#hkX').appendChild(d);return d;});\nlet HF=[540,1150,330,120];   // hook fly orbit, set from the fitted 垃圾")
    p.rep("function buildTL(){\n", "function buildTL(){\n" + HOOK_MEASURE.replace('{slab}', 'hk2').replace('{trash}', 'hk3'))
    p.rep("tl.fromTo('#hkCur',{x:1500,y:900,rotation:-10},{x:1390,y:452,rotation:0,", "tl.fromTo('#hkCur',{x:900,y:1700,rotation:-10},{x:sr.right-220,y:sr.top+sr.height*.62,rotation:0,")
    p.rep("tl.to('#hkCur',{x:1700,y:1150,rotation:20,", "tl.to('#hkCur',{x:1000,y:2000,rotation:20,")
    p.rep("placeFlies(hookFlies,t,1000,770,330,150);", "placeFlies(hookFlies,t,...HF);")
    p.rep("  buildTL();", FIT)
    # Chinese subtitles: break after the comma (never mid-word) when a line won't fit the phone width
    p.rep("const subEl=$('#sub'); let curSub=-1;",
          "const subEl=$('#sub'); let curSub=-1;\n"
          "const brk=(z,lim)=>{ const em=[...z].reduce((a,c)=>a+(/[\\u2E80-\\u9FFF\\uFF00-\\uFFEF\\u3000-\\u303F]/.test(c)?1:c===' '?.3:.56),0);\n"
          "  const i=z.indexOf('，'); return em>lim&&i>0 ? z.slice(0,i+1)+'\\n'+z.slice(i+1) : z; };")
    p.rep("$('#subZ').textContent=s[2];", "$('#subZ').textContent=brk(s[2], s[4]==='sticker'?15.5:16.5);")
    p.rep("#sub .z,#sub .e{white-space:normal;text-wrap:balance}", "#sub .z,#sub .e{white-space:normal;text-wrap:balance}\n#sub .z{white-space:pre-line}")
    # subtitles a touch larger for the phone screen
    p.rep("#sub.clean .z{font-size:46px;line-height:1.25;color:#fff}", "#sub.clean .z{font-size:54px;line-height:1.25;color:#fff}")
    p.rep("#sub.clean .e{font:500 25px/1.3 'Space Grotesk';", "#sub.clean .e{font:500 28px/1.3 'Space Grotesk';")
    p.rep("#sub.sticker .z{font-size:50px;line-height:1.2;font-weight:900;color:var(--lime)}", "#sub.sticker .z{font-size:56px;line-height:1.2;font-weight:900;color:var(--lime)}")
    p.rep("#sub.sticker .e{font:700 26px/1.3 'Space Grotesk';", "#sub.sticker .e{font:700 28px/1.3 'Space Grotesk';")
    p.rep('<div id="exCount">拆解完成<br><b id="exN">0</b>個可編輯元件<small>Every element is a real,<br>editable object.</small></div>',
          '<div id="exCount">拆解完成：<b id="exN">0</b>個可編輯元件<small>Every element is a real, editable object.</small></div>')
    # end card: 簡報救星 over the logo
    p.rep("#slogan{position:absolute;left:300px;top:385px;font:900 156px/1 'Noto Sans TC';",
          "#slogan{position:absolute;left:0;width:1080px;top:600px;text-align:center;font:900 200px/1 'Noto Sans TC';")
    p.rep("#endLogo{position:absolute;left:1000px;top:368px;width:620px;height:197px}", "#endLogo{position:absolute;left:230px;top:880px;width:620px;height:197px}")
    p.rep("#endEn{position:absolute;left:0;width:1920px;top:640px;", "#endEn{position:absolute;left:0;width:1080px;top:1150px;")
    p.rep("#ring{position:absolute;left:960px;top:466px;", "#ring{position:absolute;left:331px;top:978px;")
    p.rep("tl.set('#ring',{left:1101},0);", "tl.set('#ring',{left:331},0);")


def en(p):
    p.sub(r'      <div class="hk" id="hk1".*?(?=      <div id="hkX"></div>)', """      <div class="hk" id="hk1" style="top:250px;left:60px">
        <div class="zh boil" style="font-size:200px">Your AI</div>
        <div class="zh boil" style="font-size:200px">deck</div>
      </div>
      <div class="hk" id="hk2" style="top:690px;left:50px">
        <div class="zh boil" style="font-size:150px">is</div>
        <div class="zh" style="font-size:200px"><span class="trash boil">GARBAGE</span></div>
      </div>
      <div class="hk" id="hk3" style="top:1090px;left:110px">
        <div class="zh" style="font-size:112px"><span class="slab boil">if you can't</span></div>
        <div class="zh" style="font-size:112px;margin-top:12px"><span class="slab boil">edit it.</span></div>
      </div>
""")
    p.sub(r"// measure the fitted hook words before any tween transforms them\n.*?\nHF=\[[^\n]*\n",
          HOOK_MEASURE.replace('{slab}', 'hk3').replace('{trash}', 'hk2').replace('\\', '\\\\'))
    p.rep("tl.fromTo('#hkCur',{x:1500,y:1150,rotation:-10},", "tl.fromTo('#hkCur',{x:900,y:1800,rotation:-10},")
    p.rep("tl.to('#hkCur',{x:1750,y:1250,rotation:20,", "tl.to('#hkCur',{x:1000,y:2000,rotation:20,")
    p.sub(r"  \[\['#hk1',1560\],\['#hk2',1740\],\['#hk3',1540\]\]\.forEach.*?\n  buildTL\(\);", FIT.replace('\\', '\\\\'))
    p.rep("#sub.clean .z{font:700 46px/1.25 'Inter';", "#sub.clean .z{font:700 52px/1.25 'Inter';")
    p.rep("#sub.sticker .z{font:400 44px/1.2 'Archivo Black';", "#sub.sticker .z{font:400 50px/1.2 'Archivo Black';")
    p.rep('<div id="exCount"><b id="exN">0</b>editable<br>components<small>Every element is a real,<br>editable object.</small></div>',
          '<div id="exCount"><b id="exN">0</b>editable components<small>Every element is a real, editable object.</small></div>')
    p.rep("#exCount b{display:block;font:700 88px/1 'Space Grotesk';color:var(--dyel);margin-bottom:4px;letter-spacing:-.03em}",
          "#exCount b{display:inline-block;font:700 76px/1 'Space Grotesk';color:var(--dyel);margin-right:14px;letter-spacing:-.03em;vertical-align:-10px}")
    # end card: logo, then the slogan on two lines
    p.rep("#slogan{position:absolute;left:0;width:1920px;top:512px;text-align:center;font:800 100px/1 'Inter';",
          "#slogan{position:absolute;left:0;width:1080px;top:880px;text-align:center;font:800 126px/1 'Inter';")
    p.rep('<span id="sg1">Your deck\'s</span></span> <span class="m">', '<span id="sg1">Your deck\'s</span></span><br><span class="m">')
    p.rep("#endLogo{position:absolute;left:650px;top:262px;width:620px;height:197px}", "#endLogo{position:absolute;left:230px;top:620px;width:620px;height:197px}")
    p.rep("#endEn{position:absolute;left:0;width:1920px;top:676px;", "#endEn{position:absolute;left:0;width:1080px;top:1236px;")
    p.rep("#ring{position:absolute;left:752px;top:361px;", "#ring{position:absolute;left:331px;top:718px;")
    p.rep("tl.set('#ring',{left:752},0);", "tl.set('#ring',{left:331},0);")


for src, dst, fn in (('index.html', 'index-9x16.html', zh), ('index-en.html', 'index-en-9x16.html', en)):
    p = Page((ROOT / src).read_text(encoding='utf-8'))
    p.rep('<title>Dock Promo', '<title>Dock Promo 9:16')
    shared(p)
    fn(p)
    (ROOT / dst).write_text(p.s, encoding='utf-8')
    print('wrote', dst)
