Sem nahrávaj fotky pre veľký banner na úvodnej stránke (napr. hero/turnaj.jpg). Sú tu aj všetky súčasné fotky bannera (akcia1.jpg ... akcia7.jpg, muzi.jpg, oslava.jpg, fotky k 2 %).
Potom ich pridaj do súboru hero.json. Odporúčaná šírka fotky je 1600 – 2000 px (na šírku).

Snímka "2 % z daní" (koláž fotiek s textom, kliknutím otvorí stránku 2 %):
  { "typ": "2percenta", "odkaz": "2-percenta.html", "tlacidlo": "Chcem darovať 2 %", "text": "...", "fotky": ["hero/2p-1.jpg", ...] }
  - fotky: 3 až 5 fotiek (zobrazí sa najviac 5), najlepšie na šírku
  - text a tlacidlo sa dajú zmeniť; nepovinne aj "nadpis" a "nadtitulok"
  - mimo obdobia 2 % stačí celý tento riadok z hero.json vymazať (alebo presunúť inam v poradí)
