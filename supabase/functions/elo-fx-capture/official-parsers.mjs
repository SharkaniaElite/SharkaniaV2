/**
 * Official BCCh and ECB quotes. Pure functions, no network, secrets or DB.
 * Inputs must come from exact provider HTTPS endpoints pinned by the caller.
 * The issuer's observation date is NOT proof of its original publication time.
 */
const DATE=/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function dateOnly(value) {
  if (!DATE.test(value)) throw Error("Invalid official effective date");
  const n=Date.parse(value+"T00:00:00Z");
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0,10)!==value)
    throw Error("Nonexistent official date");
  return value;
}
function positiveQuote(value) {
  const s=String(value).trim();
  // Official BCCh examples use decimal period, sometimes decimal comma.
  if(!/^\d{1,10}([.,]\d{1,10})?$/.test(s))throw Error("Invalid official numeric quote");
  const number=Number(s.replace(",","."));
  if(!Number.isFinite(number)||number<=0||number>100000000)throw Error("Official quote out of bounds");
  return number;
}
function fromChileanDate(x) {
  const match=/^(\d{2})-(\d{2})-(\d{4})$/.exec(String(x));
  if(!match)throw Error("Invalid BCCh observation date");
  return dateOnly(match[3]+"-"+match[2]+"-"+match[1]);
}

/** Returns observed rows only. Empty response fails closed. */
export function parseBcchObservedUsd(response) {
  if(!response||response.Codigo!==0 ||
    response.Series?.seriesId!=="F073.TCO.PRE.Z.D" ||
    !Array.isArray(response.Series.Obs))
    throw Error("Invalid BCCh response or series identifier");
  const out=[];
  for(const obs of response.Series.Obs){
    if(obs?.statusCode!=="OK"||obs.value===null||obs.value===undefined||
       String(obs.value).toLowerCase()==="nan")continue;
    const date=fromChileanDate(obs.indexDateString);
    out.push({
      currency:"CLP",effectiveDate:date,quote:positiveQuote(obs.value),
      referenceId:"BCCH:F073.TCO.PRE.Z.D:"+date,
      canonical:"BCCH|F073.TCO.PRE.Z.D|"+date+"|"+String(obs.value).trim()
    });
  }
  if(!out.length)throw Error("BCCh returned no valid official observation");
  return out;
}

function csvRows(csv) {
  if(typeof csv!=="string"||csv.length>1024*1024)throw Error("Invalid ECB response size");
  const rows=[];let field="";let row=[];let quoted=false;
  for(let i=0;i<csv.length;i++){
    const x=csv[i];
    if(quoted){
      if(x==='"'&&csv[i+1]==='"'){field+='"';i++;}
      else if(x==='"'){quoted=false;}
      else{field+=x;}
    }else if(x==='"'){quoted=true;}
    else if(x===","){row.push(field);field="";}
    else if(x==="\n"){row.push(field.replace(/\r$/,""));rows.push(row);field="";row=[];}
    else{field+=x;}
  }
  if(quoted)throw Error("Unterminated ECB quoted CSV field");
  if(field||row.length){row.push(field.replace(/\r$/,""));rows.push(row);}
  return rows;
}
export function parseEcbEurUsdCsv(csv) {
  const rows=csvRows(csv);
  if(rows.length<2)throw Error("ECB returned no observations");
  const columns=rows[0].map(x=>x.trim().replace(/^\uFEFF/,""));
  const time=columns.indexOf("TIME_PERIOD");
  const value=columns.indexOf("OBS_VALUE");
  const key=columns.indexOf("KEY");
  if(time<0||value<0)throw Error("ECB CSV missing expected columns");
  const out=[];
  for(const row of rows.slice(1)){
    if(row.length!==columns.length)throw Error("Malformed ECB CSV row");
    if(key>=0&&row[key]!=="EXR.D.USD.EUR.SP00.A"&&row[key]!=="D.USD.EUR.SP00.A"){
      throw Error("ECB returned different currency pair or frequency");
    }
    if(!row[time]||!row[value])continue;
    const date=dateOnly(row[time]);
    out.push({
      currency:"EUR",effectiveDate:date,quote:positiveQuote(row[value]),
      referenceId:"ECB:EXR.D.USD.EUR.SP00.A:"+date,
      canonical:"ECB|EXR/D.USD.EUR.SP00.A|"+date+"|"+row[value]
    });
  }
  if(!out.length)throw Error("ECB returned no valid official observation");
  return out;
}
