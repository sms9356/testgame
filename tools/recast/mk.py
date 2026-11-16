import sys
B='https://elevenlabsusercontent.com/database/workspace/a7e46c9997194f8fa6a2704763500696/content_generation/'
out=open(sys.argv[2],'w')
for l in open(sys.argv[1]):
    if not l.strip(): continue
    k,s,g,sig,c=l.split()
    print(k,g,f'{B}{s}/{g}/content.mp3?Expires=1794812400&KeyName=assets-cdn-key-1&Signature={sig}',c,file=out)
