import json, math
FL=905
def rect(x,y,w,h): return [[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]
def circ(cx,cy,rx,ry=None,a0=0,a1=2*math.pi,n=28):
    ry=ry or rx; return [[round(cx+math.cos(a0+(a1-a0)*i/n)*rx,1),round(cy+math.sin(a0+(a1-a0)*i/n)*ry,1)] for i in range(n+1)]
P=lambda p,col='white',w=5,fill=False: {'p':p,'col':col,'w':w,'fill':fill}
back=[]; front=[]; texts=[]
# Wall: skirting, dado rail and two pillars
back+= [P([[0,FL-270],[1920,FL-270]],'white',3), P([[0,FL-40],[1920,FL-40]],'white',3)]
for x in (560,1010):
    back+= [P(rect(x,FL-640,70,640),'white',5), P(rect(x-14,FL-660,98,26),'white',4), P(rect(x-14,FL-26,98,26),'white',4)]
# Big sign
back.append(P(rect(640,90,640,110),'yellow',5)); texts.append({'s':'GLESGA SAVINGS BANK','x':960,'y':148,'size':52,'col':'yellow'})
# Wall clock
back+= [P(circ(1250,330,52),'white',5), P([[1250,330],[1250,292]],'white',5), P([[1250,330],[1280,346]],'white',4)]
# Vault door on the left: frame, round door, wheel and bolts
back+= [P(rect(110,FL-560,440,560),'grey',6), P(circ(330,FL-300,200),'grey',7), P(circ(330,FL-300,168),'grey',3)]
back+= [P(circ(330,FL-300,46),'yellow',6)]
for k in range(6):
    a=k*math.pi/3; back.append(P([[330,FL-300],[330+math.cos(a)*92,FL-300+math.sin(a)*92]],'yellow',6))
for k in range(8):
    a=k*math.pi/4+0.2; back.append(P(circ(330+math.cos(a)*184,FL-300+math.sin(a)*184,8),'grey',4))
texts.append({'s':'VAULT','x':330,'y':FL-590,'size':40,'col':'grey'})
# Posters
back+= [P(rect(700,FL-520,230,150),'white',4)]; texts+=[{'s':'LOANS','x':815,'y':FL-470,'size':38,'col':'pink'},{'s':'nae questions asked','x':815,'y':FL-415,'size':22,'col':'white'}]
# Queue posts and rope
for x in (690,930):
    back+= [P([[x,FL],[x,FL-150]],'yellow',7), P(circ(x,FL-160,12),'yellow',5), P(rect(x-26,FL-8,52,8),'yellow',4)]
back.append(P([[690,FL-150],[750,FL-110],[810,FL-100],[870,FL-110],[930,FL-150]],'red',6))
# Alarm bell high on the wall
back+= [P(circ(1700,250,40),'red',6), P([[1700,290],[1700,302]],'red',5), P(rect(1676,206,48,14),'red',4)]
# Counter: front panel hides the teller's legs, a glass screen above with a gap to talk through
front+= [P(rect(1190,FL-215,640,215),'brown',6,True), P([[1170,FL-215],[1850,FL-215]],'brown',10)]
for x in (1230,1330,1430,1530,1630,1730):
    front.append(P([[x,FL-160],[x+40,FL-60]],'brown',3))
front+= [P([[1200,FL-215],[1200,FL-470]],'white',4), P([[1820,FL-215],[1820,FL-470]],'white',4), P([[1200,FL-470],[1820,FL-470]],'white',4)]
front+= [P([[1240,FL-440],[1300,FL-380]],'white',2), P([[1680,FL-430],[1740,FL-370]],'white',2)]
texts.append({'s':'CASHIER','x':1510,'y':FL-500,'size':30,'col':'white'})
place={'id':'bank','label':'Bank','back':back,'front':front,'texts':texts,
 'marks':{'behind the counter':{'x':1500,'behind':True},'at the counter':{'x':1080},'by the vault':{'x':560},'queue':{'x':810}},
 'blink':[{'x':1700,'y':250,'r':30,'col':'red','every':0.18,'on':'alarm'}]}
# Props, drawn around the hand that holds them
swag=[P([[-8,0],[8,0],[16,16],[38,34],[42,62],[30,86],[-30,86],[-42,62],[-38,34],[-16,16],[-8,0]],'white',5,True),
      P([[-14,12],[14,12]],'brown',6), P([[8,44],[-2,40],[-8,46],[-8,70],[-16,72],[12,72]],'yellow',5), P([[-18,58],[4,58]],'yellow',5)]
cash=[P(rect(-26,-6,52,30),'green',4,True), P(rect(-22,-12,52,30),'green',4,True), P(circ(4,3,8),'green',3)]
props=[{'id':'swagbag','label':'Swag bag','flip':False,'paths':swag,'grip':{'side':'back','at':[-0.08,0.3],'carry':True}},
       {'id':'cashstack','label':'Wad of cash','flip':False,'paths':cash,'grip':{'at':[0.15,0.18]}}]
# Hats: a balaclava and a polis cap with the chequered band
bal=[P(circ(0,-0.02,1.12,1.16,n=30),'grey',4,'#141414'), P(circ(0,-1.2,0.2,n=12),'grey',4,'#141414')]
cap=[P([[-1.02,-0.7],[-0.98,-1.32],[0.98,-1.32],[1.02,-0.7],[-1.02,-0.7]],'white',4,'#1b2a4a'), P([[0.55,-0.72],[1.55,-0.58]],'white',6)]
for i in range(8):
    x=-1.0+i*0.25; cap.append(P([[x,-0.95],[x+0.25,-0.95],[x+0.25,-0.72],[x,-0.72],[x,-0.95]],'white',2,'#141414' if i%2 else '#f2efe6'))
cap.append(P(circ(0.15,-1.15,0.12,n=10),'yellow',3,'#f5e17a'))
hats=[{'id':'balaclava','label':'Balaclava','paths':bal,'slit':True,'col':'grey','top':1.4},{'id':'poliscap','label':'Polis cap','paths':cap,'top':1.4}]
acts=[
 {'id':'holdup','label':'Holds the place up','icon':'🔫','group':'Rough','dur':2.4,'hold':'gun','target':'person','shake':6,
  'keys':[{'p':0,'hf':[0.1,0.3],'hb':[-0.07,0.31],'mood':'angry'},{'p':0.16,'hf':[0.36,-0.06],'hb':[0.12,0.02],'lean':-0.12,'hop':0.06},{'p':0.3,'hf':[0.36,-0.08],'hb':[0.12,0.02],'lean':-0.08,'hop':0},{'p':0.85,'hf':[0.36,-0.06],'hb':[0.12,0.02],'lean':-0.08},{'p':1,'hf':[0.3,0.02],'hb':[0.05,0.2]}],
  'fx':[{'k':'shout','s':'HAUNERS UP!','p0':0.14,'p1':0.85,'col':'yellow'}]},
 {'id':'fillbag','label':'Fills the bag','icon':'💰','group':'Props','dur':2.8,'hold':'swagbag','takes':'swagbag','loop':3,
  'keys':[{'p':0,'hf':[0.2,-0.12],'hb':[0.34,0.0],'mood':'scared','emote':'sweat'},{'p':0.5,'hf':[0.2,-0.12],'hb':[0.16,-0.14]},{'p':1,'hf':[0.2,-0.12],'hb':[0.34,0.0]}]},
 {'id':'alarm','label':'Presses the alarm','icon':'🚨','group':'Body','dur':1.4,'trigger':'alarm',
  'keys':[{'p':0,'hf':[0.07,0.31],'hb':[-0.07,0.31]},{'p':0.35,'hf':[0.2,0.24],'lower':0.15,'tilt':0.1,'eyes':'open'},{'p':0.65,'hf':[0.2,0.24],'lower':0.15,'mood':'happy'},{'p':1,'hf':[0.07,0.31],'lower':0}],
  'fx':[{'k':'word','s':'BRRRRING!','p0':0.5,'p1':1,'col':'red'}]},
 {'id':'arrests','label':'Cuffs them','icon':'👮','group':'Rough','dur':2.2,'target':'person',
  'keys':[{'p':0,'hf':[0.07,0.31],'hb':[-0.07,0.31],'mood':'angry'},{'p':0.25,'hf':[0.3,0.12],'hb':[0.26,0.14],'lean':0.15},{'p':0.8,'hf':[0.28,0.16],'hb':[0.24,0.16],'lean':0.15},{'p':1,'hf':[0.12,0.24],'hb':[0.05,0.26]}],
  'fx':[{'k':'shout','s':"YER NICKED!",'p0':0.2,'p1':0.9,'col':'yellow'}]},
 {'id':'cuffed','label':'Gets cuffed','icon':'⛓','group':'Rough','dur':2.4,
  'keys':[{'p':0,'hf':[0.07,0.31],'hb':[-0.07,0.31],'mood':'shock'},{'p':0.3,'hf':[-0.1,0.3],'hb':[-0.14,0.3],'lean':0.25,'tilt':0.15,'mood':'sad'},{'p':1,'hf':[-0.1,0.3],'hb':[-0.14,0.3],'lean':0.25,'tilt':0.18,'mood':'sad'}]},
]
# The set piece: the hold up inside, then the getaway that goes wrong
R1,R2,T,PC='robber','robber2','teller','polis'
A=lambda who,k,start,dur=None,**kw: dict({'who':who,'k':k,'start':start, **({'dur':dur} if dur else {})},**kw)
sc1={'region':'europe','era':'modern','place':'bank','label':'','people':[{'pid':T,'start':'behind the counter','holding':''},{'pid':R1,'start':'off left','holding':'gun'},{'pid':R2,'start':'off left','holding':''}],
 'acts':[A(R1,'run',0.4,1.1,to='at the counter'),A(R2,'run',0.6,1.0,to='queue'),A(R1,'holdup',1.6,2.4,to=T),A(T,'handsup',2.0,1.6),
   A(T,'say',3.8,2.0,text='Aye, nae bother son'),A(T,'fillbag',5.9,2.8),A(R2,'shout',6.1,1.8,text='HURRY UP HEN!'),
   A(T,'give',8.8,1.2,to=R1,prop='swagbag'),A(R1,'run',10.1,1.2,to='off left'),A(R2,'run',10.2,1.1,to='off left'),A(T,'alarm',10.6,1.4),A(T,'say',12.2,2.4,text="Ye'll no get far, ya numpties")],
 'extra':[]}
sc2={'region':'europe','era':'modern','place':'outdoors','label':'','people':[{'pid':R1,'start':'off left','holding':'swagbag'},{'pid':R2,'start':'off left','holding':''},{'pid':PC,'start':'off right','holding':''}],
 'acts':[A(R1,'run',0.3,1.2,to='middle'),A(R2,'run',0.5,1.0,to='left'),A(R1,'shocked',1.7,1.0),A(PC,'run',1.5,1.2,to='@'+R1),A(PC,'arrests',2.9,2.2,to=R1),A(R1,'cuffed',3.1,2.6),
   A(R2,'sneak',3.4,2.4,to='off left'),A(R1,'say',5.9,2.2,text='Shug ya wee rat!'),A(PC,'shout',6.4,1.8,text='AND YOU, SON!')],
 'extra':[]}
layers=[{'type':'prop','kind':'police','style':'chalk','scene':1,'start':1.0,'end':9,'x':1.2,'y':0.755,'s':1.3,'rot':0,'op':1,'anIn':'none','inD':0.3,'anOut':'fade','outD':0.4,'fx':'none','face':'auto',
  'keys':[{'t':0,'x':1.25,'y':0.755,'s':1.3,'rot':0},{'t':1.0,'x':0.86,'y':0.755,'s':1.3,'rot':0}]},
 {'type':'stamp','text':'NEE NAW','colour':'#1d5bbd','shape':'burst','size':70,'scene':1,'start':1.2,'end':2.6,'x':0.84,'y':0.42,'s':1,'rot':-8,'op':1,'anIn':'slam','inD':0.3,'anOut':'fade','outD':0.3,'fx':'none'}]
cast=[{'role':R1,'name':'Big Rab','sex':'man','colour':'white','hat':'balaclava'},{'role':R2,'name':'Wee Shug','sex':'man','colour':'yellow','hat':'balaclava'},
      {'role':T,'name':'Senga','sex':'woman','colour':'pink','hair':'curly'},{'role':PC,'name':'PC Murdoch','sex':'man','colour':'blue','hat':'poliscap','beard':'stubble'}]
pack={'format':1,'id':'bank_robbery','name':'Bank robbery','version':1,'description':'A bank, balaclavas, a swag bag, a polis cap, five new moves and a full hold up set piece.',
 'places':[place],'props':props,'hats':hats,'actions':acts,
 'setpieces':[{'id':'bank_robbery','name':'Bank robbery','note':'The hold up, the alarm, then the getaway that goes wrong.','cast':cast,'scenes':[sc1,sc2],'layers':layers}]}
import os
json.dump(pack,open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','packs','bank_robbery.json'),'w'),separators=(',',':'))
print(len(json.dumps(pack)))
