"""Headed browser feasibility test. No cloud writes, stealth or challenge bypass."""
import json,re
from pathlib import Path
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
CARDS=[('78','GABRIEL','gabriel-dos-s-magalhaes'),('53','BRUNO FERNANDES','bruno-miguel-borges-fernandes'),('738','SALAH','mohamed-salah')]
def parse_price(text):
    text=text.strip().replace(',','').replace(' ','')
    if not re.fullmatch(r'\d+(?:\.\d+)?[KMkm]?',text):return None
    factor=1000000 if text[-1:].upper()=='M' else 1000 if text[-1:].upper()=='K' else 1
    number=float(text[:-1] if factor!=1 else text)*factor
    return int(number) if number.is_integer() and 150<=number<=15000000 else None
def main():
    results=[];accepted=[]
    with sync_playwright() as p:
        context=p.chromium.launch_persistent_context(str(ROOT/'browser-profile'),headless=False)
        page=context.pages[0] if context.pages else context.new_page()
        for ident,name,slug in CARDS:
            url='https://www.futbin.com/27/player/'+ident+'/'+slug
            try:
                response=page.goto(url,wait_until='domcontentloaded',timeout=45000)
                status=response.status if response else None
                input(name+': sprawdź stronę i wybierz PC, jeśli potrzeba. ENTER w Terminalu = odczyt; Ctrl+C = koniec. ')
                # Never use an unscoped first price as a PC price.
                candidates=page.locator('.platform-pc-only .lowest-price-1').all_text_contents()
                values={n for text in candidates if (n:=parse_price(text)) is not None}
                entry={'card_id':ident,'http_status':status,'pc_candidates':sorted(values),'url':page.url}
                if len(values)==1 and '/27/player/'+ident in page.url:
                    price=next(iter(values))
                    answer=input('Odczyt PC: '+str(price)+'. Czy zgadza się z widoczną ceną PC? [tak/nie]: ').strip().lower()
                    if answer=='tak':
                        accepted.append({'game':'fc27','platform':'pc','card_id':ident,'name':name,'version':'Card '+ident,'market_price':price,'updated_at':datetime.now(timezone.utc).isoformat(),'source_url':url})
                        entry['result']='confirmed_pc'
                    else:entry['result']='rejected_by_user'
                else:entry['result']='no_unambiguous_pc_price'
                results.append(entry)
                print(json.dumps(entry,ensure_ascii=False))
            except KeyboardInterrupt:break
            except Exception as e:
                results.append({'card_id':ident,'result':'error','error_type':type(e).__name__})
        context.close()
    (ROOT/'browser-test-report.json').write_text(json.dumps(results,indent=2,ensure_ascii=False),encoding='utf-8')
    (ROOT/'confirmed-pc-prices.json').write_text(json.dumps(accepted,indent=2,ensure_ascii=False),encoding='utf-8')
    print('Zapisano browser-test-report.json i confirmed-pc-prices.json. Potwierdzonych kart:',len(accepted))
if __name__=='__main__':main()
