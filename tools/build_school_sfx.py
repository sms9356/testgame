#!/usr/bin/env python3
"""Create school cues from Membeth's CC0 bell recording (see assets/sfx/CREDITS.md).
Usage: python tools/build_school_sfx.py /path/to/bell1.wav
Requires numpy and ffmpeg. No network or paid generation.
"""
import sys,wave,subprocess,hashlib,json
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[1];source=Path(sys.argv[1])
with wave.open(str(source)) as w:
 assert w.getsampwidth()==2 and w.getnchannels()==1
 sr=w.getframerate();x=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32768

def note(hz,duration=1.6):
 ratio=hz/1133
 idx=np.arange(int(duration*sr))*ratio
 y=np.interp(idx,np.arange(len(x)),x,left=0,right=0)
 y*=np.minimum(1,np.arange(len(y))/(sr*.004))
 y*=np.exp(-np.arange(len(y))/(sr*.5))
 y[-int(.1*sr):]*=np.linspace(1,0,int(.1*sr))
 return y

def cue(name,notes,spacing):
 y=np.zeros(int((len(notes)*spacing+2)*sr))
 for i,hz in enumerate(notes):
  a=note(hz);start=int(i*spacing*sr);y[start:start+len(a)]+=a
 y/=max(abs(y).max(),.001);y*=.7
 # A quiet fixed hallway reflection, leaving headroom for speech.
 delay=int(.13*sr);y[delay:]+=y[:-delay].copy()*.12
 tmp=Path('/tmp')/(name+'.wav')
 with wave.open(str(tmp),'wb') as w:
  w.setparams((1,2,sr,0,'NONE','not compressed'));w.writeframes((np.clip(y,-1,1)*32767).astype('<i2').tobytes())
 dest=root/'assets/sfx'/f'{name}.mp3'
 subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-i',str(tmp),'-af','highpass=f=180,lowpass=f=6500,loudnorm=I=-22:TP=-3:LRA=8','-ar','44100','-b:a','96k',str(dest)],check=True)
 return {'file':dest.name,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
result=[cue('school-bell',[1133]*24,.065),cue('class-chime',[659.25,523.25,587.33,392],.57),cue('pa-chime',[523.25,659.25,783.99],.21)]
(root/'assets/sfx/manifest.json').write_text(json.dumps({'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'cues':result},indent=2)+'\n')
