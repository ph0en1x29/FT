const {Client} = require('pg');
const c = new Client({connectionString:'postgresql://postgres.dljiubrbatmrskrzaazt:tBHo9DvozGFigHVM@aws-0-us-west-2.pooler.supabase.com:5432/postgres',ssl:{rejectUnauthorized:false}});
c.connect().then(async ()=>{
  const r = await c.query({
    text: "SELECT p.proname, pg_get_functiondef(p.oid) AS body FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND (pg_get_functiondef(p.oid) ILIKE $1 OR pg_get_functiondef(p.oid) ILIKE $2)",
    values: ['%Hourmeter reading is required%', '%hourmeter%required%']
  });
  console.log('matches:', r.rows.length);
  r.rows.forEach(x=>{
    console.log('==',x.proname,'==');
    console.log(x.body);
    console.log('');
  });
  await c.end();
}).catch(e=>{console.error(e.message);process.exit(1);});
