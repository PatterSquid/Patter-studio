/* Routes over land or sea for the Flights tab.
   Cars drive a virtual motorway network: towns joined to their natural neighbours by links that stay on land, real ferry
   crossings and bridges, and a cargo ship for oceans. Boats leave from ports and follow the coast or the shipping lanes.
   Everything is worked out in plain JavaScript from the country map, so the preview and every render worker agree exactly. */
const Routes = (() => {
  const FW = 1440, FH = 720, GW = 720, GH = 360, FD = 360 / FW, GD = 360 / GW; // fine 0.25 degree mask, 0.5 degree sea grid
  const R = Math.PI / 180, gdist = (a, b) => d3.geoDistance(a, b);
  let fine = null, waterAny = null, coastD = null, src = null, graph = null;

  // ---------- Data: junction towns, capitals, ferries, bridges, ports, canals (lat, lon) ----------
  const P2 = s => s.split(';').filter(Boolean).map(x => { const [a, b] = x.split(','); return [+b, +a]; });
  const JUNCTIONS = P2('53.76,-2.7;53.0,-2.18;50.72,-3.53;54.66,-2.75;54.97,-5.02;53.31,-4.63;51.99,-4.98;51.67,-4.92;51.13,1.31;51.08,1.17;50.8,-1.09;51.94,1.28;57.9,-5.16;57.28,-5.71;52.25,-6.34;52.66,-8.63;54.27,-8.47;53.42,-7.94;54.85,-5.82;50.37,-4.14;53.74,-0.33;55.0,-1.45;58.61,-3.55;52.63,-1.13;52.2,0.12;51.75,-1.26;' +
    '50.95,1.86;50.63,3.06;49.44,1.1;49.18,-0.37;49.64,-1.62;48.11,-1.68;47.22,-1.55;44.84,-0.58;43.6,1.44;43.61,3.88;45.78,3.08;47.32,5.04;48.57,7.75;45.83,1.26;47.9,1.9;49.26,4.03;48.39,-4.49;48.73,-3.98;46.58,0.34;44.93,4.89;' +
    '51.92,4.48;51.22,4.4;51.98,4.13;52.37,9.73;51.51,7.47;48.78,9.18;49.45,11.08;51.34,12.37;51.05,13.74;54.32,10.13;53.08,8.8;54.09,12.1;54.5,11.22;50.94,6.96;49.49,8.47;47.99,7.85;' +
    '55.6,13.0;57.71,11.97;55.4,10.39;56.16,10.2;57.59,9.96;57.44,10.54;58.15,8.0;63.43,10.4;63.83,20.26;65.58,22.15;69.65,18.96;65.01,25.47;61.5,23.76;60.45,22.27;67.28,14.4;62.39,17.3;59.38,13.5;58.41,15.62;55.33,11.14;55.31,10.79;61.12,10.47;62.47,6.15;56.88,14.81;' +
    '43.26,-2.93;43.46,-3.81;41.65,-0.88;39.47,-0.38;41.65,-4.72;40.97,-5.66;37.88,-4.78;37.18,-3.6;36.53,-6.29;36.13,-5.45;37.99,-1.13;38.88,-6.97;43.36,-8.41;42.6,-5.57;38.84,0.11;36.01,-5.6;39.47,-6.37;42.88,-8.54;41.15,-8.61;40.2,-8.42;' +
    '45.07,7.69;44.41,8.93;44.49,11.34;45.44,10.99;43.72,10.4;43.62,13.52;42.46,14.21;41.12,16.87;40.63,17.94;40.68,14.77;39.3,16.25;38.11,15.65;38.19,15.55;38.12,13.36;37.5,15.09;47.27,11.4;47.8,13.04;47.07,15.44;47.56,7.59;46.95,7.45;46.0,8.95;45.65,13.78;43.55,10.31;42.09,11.8;40.92,9.5;39.22,9.12;42.7,9.45;41.92,8.74;46.5,11.35;' +
    '49.2,16.61;48.15,17.11;46.06,14.51;52.41,16.93;54.35,18.65;51.11,17.04;51.76,19.46;49.84,24.03;46.48,30.72;49.99,36.23;48.46,35.05;53.9,27.56;47.01,28.86;46.77,23.6;44.18,28.63;43.21,27.92;42.14,24.75;40.64,22.94;42.0,21.43;41.33,19.82;43.86,18.41;43.51,16.44;42.43,19.26;43.32,21.9;47.53,21.63;54.9,23.9;38.25,21.73;39.5,20.27;39.64,22.42;41.68,26.56;40.19,29.06;38.42,27.14;37.87,32.48;37.0,35.32;38.73,35.48;41.29,36.33;41.0,39.72;39.9,41.27;37.91,40.24;38.5,43.38;41.04,28.98;41.02,29.05;40.15,26.4;40.2,26.55;50.06,19.94;49.2,22.0;45.75,21.23;48.92,24.71;52.1,23.7;' +
    '54.78,32.05;56.3,43.94;55.79,49.12;53.2,50.15;48.71,44.51;47.24,39.71;51.66,39.2;56.84,60.6;55.16,61.4;54.99,73.37;55.03,82.92;56.01,92.85;52.29,104.3;52.03,113.5;48.48,135.08;43.12,131.89;68.97,33.08;64.54,40.54;58.01,56.25;57.15,65.53;53.35,83.78;51.83,107.58;53.99,123.94;50.92,128.47;62.03,129.73;51.17,71.45;49.8,73.1;50.28,57.17;47.1,51.92;42.87,74.59;38.56,68.79;37.96,58.33;39.65,66.96;39.77,64.42;40.41,49.87;41.72,44.79;40.18,44.51;42.98,47.5;43.65,51.2;44.85,65.5;42.3,69.6;50.41,80.23;61.0,69.0;57.0,40.97;58.6,49.66;' +
    '36.2,37.13;36.34,43.13;30.51,47.78;29.38,47.99;26.43,50.1;24.47,39.61;28.38,36.57;23.59,58.41;15.37,44.19;12.79,45.03;32.65,51.67;29.59,52.58;38.08,46.29;36.3,59.6;27.18,56.27;30.28,57.08;29.5,60.86;34.35,62.2;31.61,65.71;30.18,66.99;30.2,71.47;34.0,71.58;27.52,41.69;17.02,54.09;26.23,50.59;24.45,54.38;' +
    '26.91,75.79;23.02,72.57;17.39,78.49;21.15,79.09;26.85,80.95;25.6,85.14;25.32,82.97;23.26,77.41;18.52,73.86;17.69,83.22;20.3,85.82;26.14,91.74;31.63,74.87;9.93,76.27;9.93,78.12;27.47,89.64;21.95,96.08;16.84,96.17;19.76,96.08;' +
    '18.79,98.98;17.98,102.63;11.56,104.92;16.05,108.2;5.41,100.33;1.49,103.74;25.04,102.71;22.82,108.32;30.59,114.31;34.34,108.94;36.06,103.83;43.83,87.62;39.47,75.99;42.82,93.51;39.73,98.49;29.65,91.17;36.4,94.9;45.8,126.53;41.8,123.43;28.23,112.94;34.75,113.62;32.06,118.8;40.84,111.75;26.07,119.3;24.48,118.09;29.56,106.55;26.65,106.63;43.65,111.98;35.18,129.08;33.59,130.4;34.39,132.46;35.18,136.91;38.27,140.87;40.82,140.74;43.06,141.35;41.77,140.73;33.96,130.94;40.12,124.38;-7.25,112.75;-6.97,110.42;-6.91,107.61;3.6,98.67;-2.98,104.76;-0.95,100.35;0.51,101.45;-5.93,106.0;-5.87,105.75;-8.14,114.4;-8.17,114.44;14.97,102.1;' +
    '35.76,-5.83;34.03,-5.0;30.43,-9.6;27.15,-13.2;23.68,-15.96;18.08,-15.98;20.9,-17.0;12.64,-8.0;12.37,-1.52;13.51,2.11;5.36,-4.0;9.64,-13.58;8.48,-13.23;6.3,-10.8;6.69,-1.62;6.13,1.22;6.37,2.39;12.0,8.52;11.85,13.16;12.13,15.06;3.87,11.52;4.05,9.77;4.39,18.56;0.42,9.47;-4.27,15.28;0.52,25.2;-11.66,27.48;-5.9,22.42;4.85,31.58;-4.04,39.67;-6.16,35.75;-8.9,33.46;-15.39,28.32;-13.96,33.79;-15.79,35.0;-19.83,34.85;-25.97,32.57;-15.12,39.27;-20.15,28.58;-24.65,25.91;-22.56,17.08;-22.96,14.51;-28.45,21.26;-29.12,26.21;-33.96,25.6;-28.74,24.77;-25.75,28.19;-12.78,15.74;-14.92,13.49;19.62,37.22;12.6,37.47;11.59,43.15;9.56,44.06;15.32,38.93;9.6,41.85;13.18,30.22;12.05,24.88;24.09,32.9;25.69,32.64;31.2,29.92;30.6,32.27;32.12,20.07;31.2,16.59;27.04,14.43;24.18,23.29;22.79,5.52;32.49,3.67;35.7,-0.63;36.36,6.61;34.74,10.76;16.97,7.99;16.27,-0.04;16.77,-3.0;27.67,-8.15;20.52,-13.05;13.8,8.99;13.83,20.83;21.8,31.35;-2.52,32.9;-3.39,36.68;-1.68,29.22;10.5,7.43;7.38,3.95;-8.84,13.23;-1.29,36.82;-33.6,22.2;-31.6,18.7;' +
    '44.65,-63.57;46.81,-71.21;49.9,-97.14;50.45,-104.6;53.55,-113.49;52.13,-106.67;48.38,-89.25;46.49,-80.99;50.67,-120.33;53.92,-122.75;60.72,-135.06;64.84,-147.72;58.8,-122.7;44.98,-93.27;39.1,-94.58;38.63,-90.2;35.15,-90.05;35.47,-97.52;35.08,-106.65;31.76,-106.49;29.42,-98.49;40.76,-111.89;43.62,-116.2;45.52,-122.68;38.58,-121.49;39.53,-119.81;45.78,-108.5;44.08,-103.23;41.26,-95.93;41.14,-104.82;39.77,-86.16;39.96,-83.0;40.44,-79.99;35.23,-80.84;30.33,-81.66;27.95,-82.46;33.52,-86.8;38.25,-85.76;39.1,-84.51;42.89,-78.88;35.78,-78.64;37.54,-77.44;47.66,-117.43;47.5,-111.3;46.88,-96.79;35.22,-101.83;35.2,-111.65;32.22,-110.97;32.72,-117.16;46.21,-60.25;47.57,-59.14;48.95,-54.6;47.56,-52.71;49.17,-123.94;49.28,-123.12;62.0,-129.0;56.0,-117.0;43.65,-70.26;41.82,-71.41;' +
    '25.69,-100.32;28.63,-106.07;29.07,-110.96;20.66,-103.35;23.25,-106.41;25.54,-103.41;19.17,-96.13;17.07,-96.73;20.97,-89.62;17.99,-92.93;32.51,-117.04;24.14,-110.31;27.98,-114.0;14.63,-90.51;13.69,-89.22;14.07,-87.19;12.11,-86.24;9.93,-84.08;8.98,-79.52;6.24,-75.58;3.45,-76.53;10.39,-75.48;10.96,-74.8;10.65,-71.64;-2.19,-79.89;-8.11,-79.03;-16.41,-71.54;-13.53,-71.97;-16.5,-68.15;-17.78,-63.18;-25.26,-57.58;-23.65,-70.4;-32.89,-68.83;-31.42,-64.18;-32.95,-60.65;-26.81,-65.22;-24.78,-65.41;-38.72,-62.27;-38.95,-68.06;-41.47,-72.94;-45.86,-67.48;-51.62,-69.22;-54.8,-68.3;-36.83,-73.05;-34.9,-56.16;-30.03,-51.23;-25.43,-49.27;-19.92,-43.94;-12.97,-38.5;-8.05,-34.88;-3.73,-38.52;-1.46,-48.49;-3.12,-60.02;-8.76,-63.9;-15.6,-56.1;-20.47,-54.62;-16.69,-49.26;-5.09,-42.8;-2.53,-44.3;-10.18,-48.33;2.82,-60.67;6.8,-58.16;5.85,-55.2;4.92,-52.31;8.12,-63.55;10.07,-69.32;-9.97,-67.81;-3.75,-73.25;-2.44,-54.7;-5.37,-49.12;-18.92,-48.28;-27.5,-55.0;-20.0,-69.0;' +
    '-19.26,146.82;-16.92,145.77;-23.38,150.51;-23.7,133.88;-19.65,134.19;-14.47,132.26;-20.73,139.49;-32.49,137.77;-32.13,133.68;-31.68,128.88;-32.2,121.78;-30.75,121.47;-28.78,114.61;-24.88,113.66;-20.31,118.6;-17.96,122.24;-15.77,128.74;-32.24,148.6;-36.08,146.92;-42.88,147.33;-41.18,146.35;-23.44,144.25;-29.01,134.75;-18.22,127.67;-32.93,151.78;-37.79,175.28;-39.49,176.91;-41.29,174.0;-45.87,170.5;-45.03,168.66;-26.6,120.2;-21.0,129.0');
  const CAPS = 'Afghanistan|34.53|69.17;Albania|41.33|19.82;Algeria|36.75|3.06;Angola|-8.84|13.23;Argentina|-34.6|-58.38;Armenia|40.18|44.51;Australia|-35.28|149.13;Austria|48.21|16.37;Azerbaijan|40.41|49.87;Bahamas|25.05|-77.35;Bangladesh|23.81|90.41;Belarus|53.9|27.56;Belgium|50.85|4.35;Belize|17.25|-88.77;Benin|6.5|2.6;Bhutan|27.47|89.64;Bolivia|-16.5|-68.15;Bosnia and Herzegovina|43.86|18.41;Botswana|-24.65|25.91;Brazil|-15.79|-47.88;Brunei|4.9|114.94;Bulgaria|42.7|23.32;Burkina Faso|12.37|-1.52;Burundi|-3.38|29.36;Cambodia|11.56|104.92;Cameroon|3.87|11.52;Canada|45.42|-75.7;Central African Republic|4.39|18.56;Chad|12.13|15.06;Chile|-33.45|-70.67;China|39.9|116.4;Colombia|4.71|-74.07;Congo|-4.27|15.28;Costa Rica|9.93|-84.08;Croatia|45.81|15.98;Cuba|23.11|-82.37;Cyprus|35.17|33.36;Czechia|50.08|14.44;DR Congo|-4.44|15.27;Denmark|55.68|12.57;Djibouti|11.59|43.15;Dominican Republic|18.49|-69.93;Ecuador|-0.18|-78.47;Egypt|30.04|31.24;El Salvador|13.69|-89.22;Equatorial Guinea|3.75|8.78;Eritrea|15.32|38.93;Estonia|59.44|24.75;Eswatini|-26.31|31.14;Ethiopia|9.03|38.74;Fiji|-18.14|178.44;Finland|60.17|24.94;France|48.86|2.35;Gabon|0.42|9.47;Gambia|13.45|-16.58;Georgia|41.72|44.79;Germany|52.52|13.4;Ghana|5.6|-0.19;Greece|37.98|23.73;Greenland|64.18|-51.72;Guatemala|14.63|-90.51;Guinea|9.64|-13.58;Guinea-Bissau|11.86|-15.6;Guyana|6.8|-58.16;Haiti|18.59|-72.31;Honduras|14.07|-87.19;Hungary|47.5|19.04;Iceland|64.15|-21.94;India|28.61|77.21;Indonesia|-6.21|106.85;Iran|35.69|51.39;Iraq|33.31|44.36;Ireland|53.35|-6.26;Israel|31.77|35.21;Italy|41.9|12.5;Ivory Coast|6.83|-5.29;Jamaica|18.0|-76.79;Japan|35.68|139.69;Jordan|31.95|35.93;Kazakhstan|51.17|71.45;Kenya|-1.29|36.82;Kosovo|42.66|21.17;Kuwait|29.38|47.99;Kyrgyzstan|42.87|74.59;Laos|17.98|102.63;Latvia|56.95|24.11;Lebanon|33.89|35.5;Lesotho|-29.31|27.48;Liberia|6.3|-10.8;Libya|32.89|13.19;Lithuania|54.69|25.28;Luxembourg|49.61|6.13;Madagascar|-18.88|47.51;Malawi|-13.96|33.79;Malaysia|3.14|101.69;Mali|12.64|-8.0;Mauritania|18.08|-15.98;Mexico|19.43|-99.13;Moldova|47.01|28.86;Mongolia|47.89|106.91;Montenegro|42.43|19.26;Morocco|34.02|-6.83;Mozambique|-25.97|32.57;Myanmar|19.76|96.08;Namibia|-22.56|17.08;Nepal|27.72|85.32;Netherlands|52.37|4.9;New Zealand|-41.29|174.78;Nicaragua|12.11|-86.24;Niger|13.51|2.11;Nigeria|9.08|7.4;North Korea|39.04|125.76;North Macedonia|42.0|21.43;Macedonia|42.0|21.43;Norway|59.91|10.75;Oman|23.59|58.41;Pakistan|33.68|73.05;Palestine|31.9|35.2;Panama|8.98|-79.52;Papua New Guinea|-9.44|147.18;Paraguay|-25.26|-57.58;Peru|-12.05|-77.04;Philippines|14.6|120.98;Poland|52.23|21.01;Portugal|38.72|-9.14;Puerto Rico|18.47|-66.11;Qatar|25.29|51.53;Romania|44.43|26.1;Russia|55.76|37.62;Rwanda|-1.95|30.06;Saudi Arabia|24.71|46.68;Senegal|14.72|-17.47;Serbia|44.79|20.45;Sierra Leone|8.48|-13.23;Singapore|1.35|103.82;Slovakia|48.15|17.11;Slovenia|46.06|14.51;Somalia|2.05|45.32;Somaliland|9.56|44.06;South Africa|-25.75|28.19;South Korea|37.57|126.98;South Sudan|4.85|31.58;Spain|40.42|-3.7;Sri Lanka|6.93|79.86;Sudan|15.5|32.56;Suriname|5.85|-55.2;Sweden|59.33|18.07;Switzerland|46.95|7.45;Syria|33.51|36.29;Taiwan|25.03|121.57;Tajikistan|38.56|68.79;Tanzania|-6.16|35.75;Thailand|13.76|100.5;Timor-Leste|-8.56|125.56;Togo|6.13|1.22;Trinidad and Tobago|10.66|-61.51;Tunisia|36.81|10.18;Turkey|39.93|32.86;Turkmenistan|37.96|58.33;Uganda|0.35|32.58;Ukraine|50.45|30.52;United Arab Emirates|24.45|54.38;United Kingdom|51.51|-0.13;United States|38.9|-77.04;Uruguay|-34.9|-56.16;Uzbekistan|41.3|69.24;Vanuatu|-17.73|168.32;Venezuela|10.48|-66.9;Vietnam|21.03|105.85;Western Sahara|27.15|-13.2;Yemen|15.37|44.19;Zambia|-15.39|28.32;Zimbabwe|-17.83|31.05;Scotland|55.95|-3.19;Wales|51.48|-3.18;England|51.51|-0.13;Northern Ireland|54.6|-5.93;New Caledonia|-22.27|166.44;Solomon Islands|-9.43|159.95;Falkland Islands|-51.7|-57.85;Bahrain|26.23|50.59;Malta|35.9|14.51;Mauritius|-20.16|57.5;Cape Verde|14.93|-23.51;Faroe Islands|62.01|-6.77;Northern Cyprus|35.19|33.36';
  // Ferries and fixed links: [lat, lon, lat, lon, kind] where kind b = bridge or tunnel (drives across), f = ferry
  const LINKS = ('54.97,-5.02,54.85,-5.82,f;53.31,-4.63,53.35,-6.2,f;51.99,-4.98,52.25,-6.34,f;53.41,-3.0,54.6,-5.9,f;51.13,1.31,50.95,1.86,f;51.08,1.17,50.95,1.86,b;50.8,-1.09,49.18,-0.37,f;50.8,-1.09,43.46,-3.81,f;50.37,-4.14,48.73,-3.98,f;51.94,1.28,51.98,4.13,f;53.74,-0.33,51.92,4.48,f;55.0,-1.45,52.37,4.9,f;52.25,-6.34,49.64,-1.62,f;57.9,-5.16,58.21,-6.39,f;57.15,-2.09,58.98,-2.96,f;58.98,-2.96,60.15,-1.14,f;58.61,-3.55,58.96,-3.3,f;57.28,-5.71,57.27,-5.74,b;' +
    '54.32,10.13,59.91,10.75,f;57.59,9.96,58.15,8.0,f;57.44,10.54,57.71,11.97,f;54.5,11.22,54.65,11.35,f;54.09,12.1,55.37,13.15,f;59.33,18.07,60.17,24.94,f;59.33,18.07,60.45,22.27,f;60.17,24.94,59.44,24.75,f;55.68,12.57,55.6,13.0,b;55.33,11.14,55.31,10.79,b;57.59,9.96,62.01,-6.77,f;62.01,-6.77,65.26,-14.0,f;' +
    '36.13,-5.45,35.76,-5.83,f;41.38,2.17,39.57,2.65,f;38.84,0.11,38.91,1.43,f;39.47,-0.38,39.57,2.65,f;36.53,-6.29,28.47,-16.25,f;36.53,-6.29,28.96,-13.55,f;43.3,5.37,41.92,8.74,f;43.7,7.27,42.7,9.45,f;43.55,10.31,40.92,9.5,f;42.09,11.8,40.92,9.5,f;41.39,9.16,41.24,9.19,f;40.85,14.27,38.12,13.36,f;38.11,15.65,38.19,15.55,f;38.12,13.36,36.81,10.18,f;41.12,16.87,41.32,19.45,f;40.63,17.94,39.5,20.27,f;43.62,13.52,43.51,16.44,f;43.62,13.52,38.25,21.73,f;37.94,23.65,35.34,25.13,f;35.9,14.51,36.73,14.85,f;43.3,5.37,36.75,3.06,f;41.04,28.98,41.02,29.05,b;40.15,26.4,40.2,26.55,b;' +
    '40.41,49.87,43.65,51.2,f;33.96,130.94,35.18,129.08,f;40.82,140.74,41.77,140.73,b;-5.93,106.0,-5.87,105.75,f;-8.14,114.4,-8.17,114.44,f;1.35,103.82,1.49,103.74,b;-37.81,144.96,-41.18,146.35,f;-41.29,174.78,-41.29,174.0,f;49.17,-123.94,49.28,-123.12,f;46.21,-60.25,47.57,-59.14,f;-34.6,-58.38,-34.9,-56.16,f;26.43,50.1,26.23,50.59,b;45.3,36.5,45.33,36.67,b;10.66,-61.51,10.65,-61.6,f')
    .split(';').map(s => { const v = s.split(','); return { a: [+v[1], +v[0]], b: [+v[3], +v[2]], kind: v[4] }; });
  const PORTS = P2('50.9,-1.4;51.96,1.35;51.92,4.48;53.55,9.99;51.22,4.4;49.49,0.1;36.13,-5.45;39.47,-0.38;44.41,8.93;37.94,23.65;41.04,28.98;38.72,-9.14;53.35,-6.2;55.95,-4.76;40.67,-74.04;36.85,-76.29;32.08,-81.09;25.77,-80.18;29.73,-95.27;29.95,-90.07;33.74,-118.27;37.8,-122.3;47.6,-122.34;49.28,-123.12;45.5,-73.55;44.65,-63.57;19.17,-96.13;9.36,-79.9;8.95,-79.57;10.39,-75.48;-23.96,-46.33;-22.9,-43.17;-34.6,-58.38;-33.05,-71.62;-12.05,-77.15;6.45,3.39;5.63,0.01;14.69,-17.43;5.29,-4.01;-29.87,31.03;-33.92,18.43;-4.04,39.67;-6.82,39.29;11.59,43.15;21.49,39.17;31.26,32.3;31.2,29.92;33.6,-7.6;25.0,55.06;24.85,66.99;18.95,72.84;6.93,79.86;13.08,80.29;22.57,88.36;22.33,91.83;1.26,103.84;3.0,101.4;-6.1,106.88;13.68,100.57;10.77,106.71;22.3,114.17;31.23,121.47;22.54,114.06;35.1,129.04;35.44,139.64;34.65,135.43;14.59,120.97;-33.86,151.21;-37.81,144.96;-27.47,153.03;-32.05,115.74;-12.46,130.84;-36.84,174.77;-41.29,174.78;21.31,-157.86;-18.14,178.44;64.15,-21.94;4.18,73.51;28.47,-16.25;39.57,2.65;23.14,-82.36;17.97,-76.79;61.22,-149.9;58.21,-6.39;60.15,-1.14;58.98,-2.96;-8.75,115.17;-20.16,57.5;-18.15,49.4;25.28,51.53;26.23,50.59;29.07,48.14;-41.18,146.35;43.11,131.88;59.93,30.25;59.44,24.75;55.68,12.57;57.71,11.97;59.91,10.75;60.39,5.32;53.41,-3.0;54.6,-5.9;45.44,12.33;45.65,13.78;40.85,14.27;38.12,13.36;35.9,14.51;35.34,25.13;34.67,33.04;32.82,34.99;36.8,10.3;36.75,3.06;35.78,-5.81;28.96,-13.55;14.93,-23.51;-8.8,13.24;-25.97,32.57;-20.15,57.5;12.8,45.03;23.62,58.59;9.0,38.75;19.62,37.22;-1.3,36.8;-12.04,-77.14;-0.95,-80.73;-2.19,-79.89;10.6,-66.93;-3.73,-38.52;-8.05,-34.88;-12.97,-38.5;-30.03,-51.23;-34.9,-56.16;-53.16,-70.92;-45.86,-67.48;18.47,-66.11;18.49,-69.93;18.55,-72.34;25.05,-77.35;46.81,-71.21;47.56,-52.71;64.18,-51.72;-9.44,147.18;-22.27,166.44;-17.73,168.32;-9.43,159.95;-51.7,-57.85');
  // Canals and narrow straits the coarse map can close up: carved open so ships can use them
  const CANALS = [[[32.3, 31.26], [32.33, 30.6], [32.55, 29.95]], [[-79.9, 9.36], [-79.68, 9.1], [-79.57, 8.95]], [[28.98, 41.0], [29.1, 41.2]], [[26.4, 40.1], [26.7, 40.4]], [[-5.6, 35.95], [-5.3, 36.0]], [[12.6, 55.7], [12.7, 55.4]], [[103.6, 1.2], [104.3, 1.3]], [[9.1, 54.1], [10.1, 54.3]], [[43.4, 12.6], [43.3, 12.8]], [[56.3, 26.5], [56.6, 26.2]]];

  // ---------- Land mask ----------
  function build() {
    const st = GeoData.state, land = st.land || st.landLo; if (!land) return false; if (src === land && fine) return true;
    fine = new Uint8Array(FW * FH); graph = null;
    // Scanline fill of each polygon (even odd within it, so holes work), unioned across countries so overlaps never cancel
    land.features.forEach(f => { const g = f.geometry; if (!g) return; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      polys.forEach(p => { const rows = new Map();
        p.forEach(r => { for (let i = 0; i < r.length - 1; i++) { const [x0, y0] = r[i], [x1, y1] = r[i + 1]; if (Math.abs(x1 - x0) > 180) continue; const py0 = (90 - y0) / FD, py1 = (90 - y1) / FD;
          const a = Math.ceil(Math.min(py0, py1) - 0.5), b = Math.ceil(Math.max(py0, py1) - 0.5) - 1; for (let row = Math.max(0, a); row <= Math.min(FH - 1, b); row++) { const tt = (row + 0.5 - py0) / (py1 - py0); if (!isFinite(tt)) continue; const xc = (x0 + (x1 - x0) * tt + 180) / FD; let L = rows.get(row); if (!L) rows.set(row, L = []); L.push(xc); } } });
        rows.forEach((xs, row) => { xs.sort((m, n) => m - n); for (let k = 0; k + 1 < xs.length; k += 2) { const a = Math.max(0, Math.ceil(xs[k] - 0.5)), b = Math.min(FW - 1, Math.floor(xs[k + 1] - 0.5)); for (let x = a; x <= b; x++) fine[row * FW + x] = 1; } });
      }); });
    waterAny = new Uint8Array(GW * GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { let w = 0; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) if (!fine[(j * 2 + dy) * FW + i * 2 + dx]) w++; waterAny[j * GW + i] = w >= 2 ? 1 : 0; }
    CANALS.forEach(line => { for (let k = 0; k + 1 < line.length; k++) { const gi = d3.geoInterpolate(line[k], line[k + 1]), n = 30; for (let s = 0; s <= n; s++) { const [i, j] = cellOf(...gi(s / n)); waterAny[j * GW + i] = 1; } } });
    // Distance from land in sea cells (1 = right off the coast), for coast hugging and keeping off the beach
    coastD = new Uint8Array(GW * GH).fill(255); let q = [];
    for (let c = 0; c < GW * GH; c++) if (!waterAny[c]) { coastD[c] = 0; q.push(c); }
    for (let d = 1; d < 40 && q.length; d++) { const nq = []; q.forEach(c => { const j = Math.floor(c / GW), i = c - j * GW; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const jj = j + dj; if (jj < 0 || jj >= GH) continue; const n = jj * GW + (i + di + GW) % GW; if (coastD[n] === 255) { coastD[n] = d; nq.push(n); } } }); q = nq; }
    src = land; return true;
  }
  const isLand = (lon, lat) => { const x = Math.floor((((lon + 180) % 360) + 360) % 360 / FD), y = Math.floor((90 - lat) / FD); return y >= 0 && y < FH ? fine[y * FW + Math.min(FW - 1, x)] === 1 : false; };
  const cellOf = (lon, lat) => [Math.min(GW - 1, Math.max(0, Math.floor((((lon + 180) % 360) + 360) % 360 / GD))), Math.min(GH - 1, Math.max(0, Math.floor((90 - lat) / GD)))];
  const ctr = (i, j) => [i * GD - 180 + GD / 2, 90 - j * GD - GD / 2];
  function Heap() { const k = [], v = []; return { push(key, val) { k.push(key); v.push(val); let i = k.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; } },
    pop() { const top = v[0], lk = k.pop(), lv = v.pop(); if (k.length) { k[0] = lk; v[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < k.length && k[l] < k[m]) m = l; if (r < k.length && k[r] < k[m]) m = r; if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; } } return top; }, get size() { return k.length; } }; }

  // ---------- Sea routes ----------
  // Cost of a sea cell by distance from land. Coast huggers (dinghy, ferry) want to stay a cell or two off the shore,
  // cruise ships keep a respectful distance, cargo ships take the open shipping lanes. Nobody likes scraping the beach.
  const STYLE = { coast: d => d <= 1 ? 1.3 : 0.75 + 0.14 * Math.min(d - 2, 14), cruise: d => d <= 1 ? 1.25 : 0.85 + 0.06 * Math.min(d - 2, 12), cargo: d => d <= 1 ? 1.2 : d <= 2 ? 1.0 : 0.95 };
  const MINC = { coast: 0.75, cruise: 0.85, cargo: 0.95 };
  function seaSearch(A, B, style, grow) {
    const N = GW * GH, g = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N), h = Heap(), cf = STYLE[style] || STYLE.cargo, mc = MINC[style] || 0.95;
    const cost = c => waterAny[c] ? cf(coastD[c]) : Infinity;
    const minR = 1.2 * grow * R, startR = Math.max(A.reach || 0, minR), goalR = Math.max(B.reach || 0, minR), seeds = [], goals = new Map();
    const near = (P, rad, fn) => { const [ci, cj] = cellOf(P.pt[0], P.pt[1]), span = Math.ceil(rad / R / GD) + 1; for (let dj = -span; dj <= span; dj++) { const j = cj + dj; if (j < 0 || j >= GH) continue; const w = Math.min(GW / 2, Math.ceil(span / Math.max(0.15, Math.cos((90 - j * GD) * R)))); for (let di = -w; di <= w; di++) { const i = ((ci + di) % GW + GW) % GW, c = j * GW + i, d = gdist(P.pt, ctr(i, j)); if (d <= rad) fn(c, d); } } };
    // A boat leaving or reaching a country uses water right off that country's own coast; landlocked ones use the nearest sea
    const coast = (P, c) => { if (!P.feat) return true; const j = Math.floor(c / GW), i = c - j * GW; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const jj = j + dj; if (jj < 0 || jj >= GH) continue; const n = jj * GW + (i + di + GW) % GW; const q = ctr((i + di + GW) % GW, jj); if (isLand(q[0], q[1]) && inside(P.feat, n)) return true; } return false; };
    const ends = (P, rad, out) => { let n = 0; const tryF = strict => near(P, rad, (c, d) => { if (waterAny[c] && (!strict || coast(P, c))) { n++; out(c, d * 2.5); } }); tryF(true); if (!n && P.feat) tryF(false); };
    ends(A, startR, (c, d) => seeds.push([c, d])); ends(B, goalR, (c, d) => goals.set(c, d));
    if (!seeds.length || !goals.size) return null;
    const hr = c => { const j = Math.floor(c / GW), i = c - j * GW; return Math.max(0, gdist(ctr(i, j), B.pt) - goalR) * mc; };
    seeds.forEach(([c, d]) => { if (d < g[c]) { g[c] = d; h.push(d + hr(c), c); } });
    let best = Infinity, bestC = -1, n = 0;
    while (h.size && n++ < 500000) {
      const c = h.pop(); if (done[c]) continue; done[c] = 1; if (g[c] + hr(c) >= best) break;
      if (goals.has(c) && g[c] + goals.get(c) < best) { best = g[c] + goals.get(c); bestC = c; }
      const j = Math.floor(c / GW), i = c - j * GW, cc = ctr(i, j), kc = cost(c);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const jj = j + dj; if (jj < 4 || jj >= GH - 4) continue; const ii = (i + di + GW) % GW, nc = jj * GW + ii; if (done[nc]) continue;
        const k = cost(nc); if (!isFinite(k)) continue; const ng = g[c] + gdist(cc, ctr(ii, jj)) * (k + kc) / 2; if (ng < g[nc]) { g[nc] = ng; from[nc] = c; h.push(ng + hr(nc), nc); } }
    }
    if (bestC < 0) return null;
    const cells = []; for (let c = bestC; c >= 0; c = from[c]) cells.push(c); return cells.reverse();
  }
  // Water line of sight on the fine mask
  function clearSea(a, b) { const d = gdist(a, b), n = Math.max(2, Math.ceil(d / R / 0.1)), gi = d3.geoInterpolate(a, b); for (let k = 1; k < n; k++) { const p = gi(k / n); if (isLand(p[0], p[1])) return false; } return true; }
  // Chaikin corner cutting on the sphere, keeping the ends fixed
  function smooth(pts, it = 2) { for (let k = 0; k < it && pts.length > 2; k++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const gi = d3.geoInterpolate(pts[i], pts[i + 1]); if (i > 0) o.push(gi(0.25)); if (i < pts.length - 2) o.push(gi(0.75)); } o.push(pts[pts.length - 1]); pts = o; } return pts; }
  // Thin the cell path but never skip more than a few degrees, so the coast hugging shape survives; then round it off
  function seaLine(cells, style) {
    const pts = cells.map(c => { const j = Math.floor(c / GW), i = c - j * GW; return ctr(i, j); });
    const maxHop = (style === 'cargo' ? 30 : style === 'cruise' ? 6 : 2) * R, out = [pts[0]]; let i = 0;
    while (i < pts.length - 1) { let j = Math.min(pts.length - 1, i + 1); for (let k = i + 2; k < pts.length; k++) { if (gdist(pts[i], pts[k]) > maxHop || !clearSea(pts[i], pts[k])) break; j = k; } out.push(pts[j]); i = j; }
    return smooth(out, 3);
  }
  function seaRoute(A, B, style) {
    if ((A.reach || 0) < 1e-6 && (B.reach || 0) < 1e-6 && !isLand(...A.pt) && !isLand(...B.pt) && gdist(A.pt, B.pt) < 1.5 * R && clearSea(A.pt, B.pt)) return [A.pt, B.pt];
    for (let m = 1; m <= 16; m *= 2) { const c = seaSearch(A, B, style, m); if (c) return seaLine(c, style); }
    return null;
  }

  // ---------- Road network ----------
  const V3 = p => { const lo = p[0] * R, la = p[1] * R; return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // Land line of sight that forgives the first and last stretch, so towns on the very edge of the coast still connect
  function clearLand(a, b) { const d = gdist(a, b), n = Math.max(3, Math.ceil(d / R / 0.1)), gi = d3.geoInterpolate(a, b), skip = Math.min(0.2 * R, d * 0.22); for (let k = 1; k < n; k++) { const f = k / n; if (f * d < skip || (1 - f) * d < skip) continue; const p = gi(f); if (!isLand(p[0], p[1])) return false; } return true; }
  function coastal(p) { for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, q = [p[0] + Math.cos(a) * 0.5 / Math.max(0.2, Math.cos(p[1] * R)), p[1] + Math.sin(a) * 0.5]; if (!isLand(q[0], q[1])) return true; } return false; }
  function buildGraph() {
    if (graph) return graph;
    const nodes = [], add = (p, port) => { const v = V3(p); for (const n of nodes) if (dot(n.v, v) > Math.cos(0.12 * R)) { if (port) n.port = true; return n.id; } nodes.push({ id: nodes.length, p, v, port: !!port, adj: [] }); return nodes.length - 1; };
    GeoData.CITIES.forEach(c => add([c.lon, c.lat])); JUNCTIONS.forEach(p => add(p)); CAPS.split(';').forEach(s => { const [, la, lo] = s.split('|'); add([+lo, +la]); });
    LINKS.forEach(L => { L.ia = add(L.a); L.ib = add(L.b); }); PORTS.forEach(p => add(p, true));
    nodes.forEach(n => { n.coast = n.port || coastal(n.p); });
    // Candidate road links: nearby towns that can see each other over land
    const cand = nodes.map(() => []), cMax = Math.cos(9 * R);
    for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) { const dd = dot(nodes[a].v, nodes[b].v); if (dd < cMax) continue; const d = Math.acos(Math.min(1, dd)); if (!clearLand(nodes[a].p, nodes[b].p)) continue; cand[a].push([b, d]); cand[b].push([a, d]); }
    // Keep only natural neighbours (relative neighbourhood graph): drop a link when a town sits between its two ends,
    // so the network looks like motorways from town to town rather than a spider web of straight lines
    const has = cand.map(l => new Map(l));
    for (let a = 0; a < nodes.length; a++) for (const [b, d] of cand[a]) { if (b < a) continue; let keep = true;
      for (const [c, dac] of cand[a]) { if (c === b || dac >= d) continue; const dbc = has[b].get(c); if (dbc !== undefined && dbc < d) { keep = false; break; } }
      if (keep) { nodes[a].adj.push({ to: b, d, kind: 'road' }); nodes[b].adj.push({ to: a, d, kind: 'road' }); } }
    // Lonely towns (deserts, tundra) reach a bit further for their nearest land neighbour
    nodes.forEach(n => { if (n.adj.length) return; let best = null; nodes.forEach(m => { if (m === n) return; const d = Math.acos(Math.min(1, dot(n.v, m.v))); if (d < 16 * R && (!best || d < best[1]) && clearLand(n.p, m.p)) best = [m.id, d]; }); if (best) { n.adj.push({ to: best[0], d: best[1], kind: 'road' }); nodes[best[0]].adj.push({ to: n.id, d: best[1], kind: 'road' }); } });
    LINKS.forEach(L => { const d = gdist(L.a, L.b), kind = L.kind === 'b' ? 'road' : 'ferry'; nodes[L.ia].adj.push({ to: L.ib, d, kind, link: L }); nodes[L.ib].adj.push({ to: L.ia, d, kind, link: L }); });
    graph = { nodes, ports: nodes.filter(n => n.coast) };
    return graph;
  }
  const capCache = new Map();
  function capitalOf(feat) {
    if (capCache.has(feat)) return capCache.get(feat); let pt = null;
    for (const s of CAPS.split(';')) { const [nm, la, lo] = s.split('|'); const f = GeoData.find(nm); if (f && f.name === feat.name) { pt = [+lo, +la]; break; } }
    capCache.set(feat, pt); return pt;
  }
  // Nearest network town to a point, preferring ones that can be reached over land
  function nearestNode(G, p, feat) {
    const v = V3(p); let best = null, bestLand = null;
    G.nodes.forEach(n => { const d = Math.acos(Math.min(1, dot(n.v, v))); if (feat && !d3.geoContains(feat, n.p) && d > 0.12 * R) return; if (!best || d < best[1]) best = [n, d]; if (d < 6 * R && (!bestLand || d < bestLand[1]) && clearLand(p, n.p)) bestLand = [n, d]; });
    return (bestLand && (!best || bestLand[1] < best[1] * 3 + 0.5 * R) ? bestLand : best) || [G.nodes[0], 0];
  }
  // A* over towns. Roads cost their length, ferries a little more, and an ocean crossing on a cargo ship costs a lot,
  // so the car only takes the ship when there's genuinely no road or ferry.
  function drive(G, s, t) {
    const N = G.nodes.length, g = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), via = new Array(N), done = new Uint8Array(N), h = Heap(), T = G.nodes[t];
    const hr = n => Math.acos(Math.min(1, dot(G.nodes[n].v, T.v)));
    g[s] = 0; h.push(hr(s), s);
    while (h.size) { const a = h.pop(); if (done[a]) continue; done[a] = 1; if (a === t) break; const A = G.nodes[a];
      const relax = (b, c, e) => { const ng = g[a] + c; if (ng < g[b]) { g[b] = ng; from[b] = a; via[b] = e; h.push(ng + hr(b), b); } };
      A.adj.forEach(e => relax(e.to, e.kind === 'ferry' ? e.d * 1.6 + 0.01 : e.d * 1.0, e));
      if (A.coast) G.ports.forEach(B => { if (B.id === a) return; const d = Math.acos(Math.min(1, dot(A.v, B.v))); if (d < 1 * R) return; relax(B.id, d * 2.2 + 0.32, { to: B.id, d, kind: 'ship' }); }); }
    if (!isFinite(g[t])) return null;
    const steps = []; for (let c = t; c !== s; c = from[c]) steps.push({ a: from[c], b: c, e: via[c] }); return steps.reverse();
  }
  // Turn a chain of towns into something that reads like a road: densified, with a gentle wander that stays on land, then smoothed
  function roadLine(pts) {
    const out = [pts[0]];
    for (let k = 0; k + 1 < pts.length; k++) { const a = pts[k], b = pts[k + 1], d = gdist(a, b), n = Math.max(2, Math.ceil(d / R / 0.35)), gi = d3.geoInterpolate(a, b), amp = Math.min(0.22, d / R * 0.05), ph = (a[0] * 12.9898 + b[1] * 78.233) % 6.28;
      const dx = (b[0] - a[0]) * Math.cos((a[1] + b[1]) / 2 * R), dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      for (let i = 1; i <= n; i++) { const f = i / n, p = gi(f); if (i < n) { const w = amp * Math.sin(Math.PI * f) * (Math.sin(f * 7.1 + ph) * 0.7 + Math.sin(f * 15.3 + ph * 2) * 0.3), q = [p[0] + nx * w / Math.max(0.2, Math.cos(p[1] * R)), p[1] + ny * w]; out.push(isLand(q[0], q[1]) ? q : p); } else out.push(p); } }
    const sm = smooth(out, 2); return sm.map((p, i) => (isLand(p[0], p[1]) || i === 0 || i === sm.length - 1) ? p : null).filter(Boolean);
  }
  function carLegs(A, B) {
    const G = buildGraph(); const sp = A.cap || A.pt, tp = B.cap || B.pt, [sn] = nearestNode(G, sp, A.feat), [tn] = nearestNode(G, tp, B.feat);
    const legs = []; const push = (kind, pts) => { const last = legs[legs.length - 1]; if (last && last.kind === kind && kind === 'road') { last.pts.push(...pts.slice(1)); } else legs.push({ kind, pts: pts.slice() }); };
    if (gdist(sp, sn.p) > 0.05 * R) push('road', [sp, sn.p]);
    if (sn.id !== tn.id) { const steps = drive(G, sn.id, tn.id); if (!steps) return null;
      steps.forEach(st => { const a = G.nodes[st.a].p, b = G.nodes[st.b].p;
        if (st.e.kind === 'road') push('road', [a, b]);
        else { const style = st.e.kind === 'ship' ? 'cargo' : 'coast', line = clearSea(a, b) && gdist(a, b) < 3 * R ? [a, b] : (seaRoute({ pt: a }, { pt: b }, style) || [a, b]); const pl = line.slice(); pl[0] = a; pl[pl.length - 1] = b; legs.push({ kind: st.e.kind, pts: pl }); } }); }
    if (gdist(tp, tn.p) > 0.05 * R) push('road', [tn.p, tp]);
    if (!legs.length) legs.push({ kind: 'road', pts: [sp, tp] });
    legs.forEach(L => { if (L.kind === 'road') L.pts = roadLine(L.pts); });
    return legs;
  }
  // ---------- Assembly ----------
  const unwrap = pts => { const o = [pts[0].slice()]; for (let i = 1; i < pts.length; i++) { let lo = pts[i][0]; const prev = o[i - 1][0]; while (lo - prev > 180) lo -= 360; while (lo - prev < -180) lo += 360; o.push([lo, pts[i][1]]); } return o; };
  function assemble(legs, A, B, medium, links) {
    const pts = [], kinds = []; legs.forEach((L, k) => L.pts.forEach((q, i) => { if (pts.length && i === 0) return; pts.push(q); kinds.push(L.kind); }));
    if (pts.length < 2) pts.push(pts[0]), kinds.push(kinds[0]);
    const P = unwrap(pts), lens = [0]; for (let i = 1; i < P.length; i++) lens.push(lens[i - 1] + gdist(P[i - 1], P[i])); const L = lens[lens.length - 1] || 1e-6;
    const seg = f => { const d = Math.max(0, Math.min(1, f)) * L; let lo = 1, hi = lens.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (lens[m] < d) lo = m + 1; else hi = m; } return [lo, d]; };
    const at = f => { const [i, d] = seg(f), a = lens[i - 1], b = lens[i]; return d3.geoInterpolate(P[i - 1], P[i])(b > a ? (d - a) / (b - a) : 0); };
    const runs = []; for (let i = 1; i < P.length; i++) { const kd = kinds[i], last = runs[runs.length - 1]; if (last && last.kind === kd) last.f1 = lens[i] / L; else runs.push({ kind: kd, sea: kd !== 'road', f0: lens[i - 1] / L, f1: lens[i] / L }); }
    if (runs.length) { runs[0].f0 = 0; runs[runs.length - 1].f1 = 1; }
    return { pts: P, lens, len: L, at, seaAt: f => kinds[seg(f)[0]] !== 'road', runs, medium, startLink: links && links[0], endLink: links && links[1] };
  }
  const inCache = new Map(); let inFeat = null;
  const inside = (feat, n) => { if (inFeat !== feat) { inFeat = feat; inCache.clear(); } let v = inCache.get(n); if (v === undefined) { const j = Math.floor(n / GW), i = n - j * GW; v = d3.geoContains(feat, ctr(i, j)); inCache.set(n, v); } return v; };
  // The port a boat uses for a place: the place itself if it's on the coast, else the nearest port (in the same country for countries)
  function portFor(P) {
    const G = buildGraph(), p = (P.feat && capitalOf(P.feat)) || P.pt;
    if (!P.feat && coastal(p)) return { pt: p, link: null };
    let best = null; G.nodes.forEach(n => { if (!n.coast) return; if (P.feat && !d3.geoContains(P.feat, n.p)) return; const d = gdist(p, n.p); if (!best || d < best[1]) best = [n, d]; });
    if (P.feat) return best ? { pt: best[0].p, link: null } : { pt: P.pt, reach: P.reach, feat: P.feat, link: null };
    return best && best[1] < 8 * R ? { pt: best[0].p, link: best[1] > 0.15 * R ? true : null } : { pt: p, link: true };
  }
  const cache = new Map();
  // route(A, B, 'land' | 'sea', style) with A, B = { pt: [lon, lat], reach: radians, feat }. Null falls back to a straight line.
  function route(A, B, medium, style) {
    if (!build()) return null; const key = [A.pt, A.reach, B.pt, B.reach, medium, style, GeoData.state.version].join('|'); if (cache.has(key)) return cache.get(key);
    let res = null;
    try {
      if (medium === 'land') {
        const a = Object.assign({}, A, { cap: A.feat && capitalOf(A.feat) }), b = Object.assign({}, B, { cap: B.feat && capitalOf(B.feat) }), legs = carLegs(a, b);
        if (legs) res = assemble(legs, a, b, 'land', null);
      } else {
        const pa = portFor(A), pb = portFor(B), line = seaRoute(pa, pb, style || 'cargo');
        if (line) { const pts = line.slice(); if (!pa.reach) pts[0] = pa.pt; if (!pb.reach) pts[pts.length - 1] = pb.pt;
          const sl = !A.feat && gdist(A.pt, pts[0]) > 0.15 * R ? [A.pt, pts[0]] : null, el = !B.feat && gdist(B.pt, pts[pts.length - 1]) > 0.15 * R ? [pts[pts.length - 1], B.pt] : null;
          res = assemble([{ kind: 'sea', pts }], A, B, 'sea', [sl, el]); }
      }
    } catch (e) { if (typeof console !== 'undefined') console.warn('Route failed', e); res = null; }
    cache.set(key, res); if (cache.size > 60) cache.delete(cache.keys().next().value); return res;
  }
  return { route, isLand: (lon, lat) => build() && isLand(lon, lat), get ready() { return build(); }, _graph: () => build() && buildGraph() };
})();
