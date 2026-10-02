"""Import verified FC27 PC observations from an existing Apify dataset.
No Actor runs are started. Never print credentials or authenticated URLs.
"""
import os,json,re,sys,argparse
from datetime import datetime,timezone
from urllib.request import Request,urlopen
def request(url,headers=None,data=None):
    req=Request(url,headers=headers or {},data=None if data is None else json.dumps(data).encode())
    with urlopen(req,timeout=30) as response:return json.loads(response.read() or b'null')
def normalize(items):
    cards={};prices={}
    for item in items:
        url=item.get('url','')
        match=re.match(r'https://www\.futbin\.com/27/player/(\d+)(?:/|$)',url)
        p=item.get('prices',{}).get('pc',{}).get('lowestPrice')
        timestamp=item.get('scrapedAt')
        if not match or isinstance(p,bool) or not isinstance(p,(int,float)) or int(p)!=p or p<150 or p>15000000:continue
        try:
            observed=datetime.fromisoformat(timestamp.replace('Z','+00:00'))
            if observed.tzinfo is None or observed>datetime.now(timezone.utc):continue
        except (ValueError,TypeError,AttributeError):continue
        ident=match.group(1)
        name=re.sub(r' EA FC 27 Prices and Rating$','',str(item.get('playerName') or ident),flags=re.I)
        cards[ident]={'game':'fc27','card_id':ident,'name':name,'version':'Card '+ident,'source_url':url}
        prices[(ident,timestamp)]={'game':'fc27','card_id':ident,'platform':'pc','observed_at':timestamp,'price':int(p),'source':'apify-dataset'}
    return list(cards.values()),list(prices.values())
def latest_dataset(token):
    headers={'Authorization':'Bearer '+token}
    result=request('https://api.apify.com/v2/acts/getdataforme~futbin-category-details/runs?status=SUCCEEDED&desc=1&limit=1',headers)
    runs=result['data']['items']
    if not runs:raise ValueError('No completed Actor run available.')
    return runs[0]['defaultDatasetId']
def import_rows(cards,prices):
    root=os.environ['SUPABASE_URL'].rstrip('/')+'/rest/v1/'
    secret=os.environ['SUPABASE_SERVICE_ROLE_KEY']
    headers={'apikey':secret,'Authorization':'Bearer '+secret,'Content-Type':'application/json'}
    for offset in range(0,len(prices),500):
        batch=prices[offset:offset+500]
        ids={p['card_id'] for p in batch}
        request(root+'rpc/import_fcscanner_prices',headers,{'cards':[c for c in cards if c['card_id'] in ids],'prices':batch})
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--file');parser.add_argument('--dry-run',action='store_true');args=parser.parse_args()
    if args.file:
        with open(args.file,encoding='utf-8') as f:items=json.load(f)
    else:
        token=os.environ['APIFY_API_TOKEN'];dataset=os.environ.get('APIFY_DATASET_ID') or latest_dataset(token)
        if not re.fullmatch(r'[a-zA-Z0-9_-]+',dataset):raise ValueError('Invalid dataset ID.')
        items=[];offset=0
        while True:
            page=request('https://api.apify.com/v2/datasets/'+dataset+'/items?clean=true&format=json&limit=1000&offset='+str(offset),{'Authorization':'Bearer '+token})
            items.extend(page)
            if len(page)<1000:break
            offset+=len(page)
            if offset>100000:raise ValueError('Dataset too large.')
    cards,prices=normalize(items)
    if not prices:raise ValueError('No valid FC27 PC prices. Database unchanged.')
    if not args.dry_run:import_rows(cards,prices)
    print(json.dumps({'valid_cards':len(cards),'valid_observations':len(prices),'dry_run':args.dry_run}))
if __name__=='__main__':
    try:main()
    except Exception as error:
        print('Collector failed: '+type(error).__name__+'. Check source, secrets and schema configuration.',file=sys.stderr)
        sys.exit(1)
