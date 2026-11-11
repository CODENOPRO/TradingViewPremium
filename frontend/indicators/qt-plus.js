// This Source Code Form is subject to the Mozilla Public License, v. 2.0.
// https://mozilla.org/MPL/2.0/
// Original QT+ by 4XS Pine Script © Enigma. QS adaptations © Danielliuks / @Crypto_MM_.
// Native JavaScript TEST PORT. See indicators/README.md for the parity limits.
const indicator = (() => {
  const defaults = {
  "modeltype": "Auto",
  "alerttype": "All",
  "i_font": "small",
  "show_sbar_st": true,
  "sbar_pos_in": "Top Right",
  "sbar_size_in": "Small",
  "c_sb_bull": "#1e88e5ff",
  "c_sb_bear": "#e53935ff",
  "c_sb_neut": "#787b8680",
  "c_sb_sand": "#424242ff",
  "sb_show_y": false,
  "sb_show_q": false,
  "sb_show_m": true,
  "sb_show_w": true,
  "sb_show_d": true,
  "sb_show_90m": true,
  "sb_show_mic": true,
  "use_psp_adv": true,
  "max_psp_bars": 30,
  "psp_vis_limit": "15",
  "psp_mode": "Body Only",
  "psp_bull_clr": "#3292e042",
  "psp_bear_clr": "#d8393936",
  "psp_bull_shape": "●",
  "psp_bear_shape": "●",
  "psp_size_str": "Tiny",
  "psp_bull_body": "#2195f345",
  "psp_bear_body": "#dd455c47",
  "hidelines": false,
  "ssmt_history_limit": 50,
  "hidelabels": false,
  "show_smtMo": true,
  "show_smtW": true,
  "show_smtD": true,
  "show_smtN": true,
  "show_smtm": true,
  "show_smtQ": true,
  "show_smtY": true,
  "smtMo_clr": "#0b0b0a",
  "smtW_clr": "#048aea",
  "smtD_clr": "#f1970f",
  "smtN_clr": "#9c27b0",
  "smtm_clr": "#000080",
  "smtQ_clr": "#00e676",
  "smtY_clr": "#e40d1b",
  "show_hsmtMo": false,
  "show_hsmtW": false,
  "show_hsmtD": false,
  "show_hsmtN": false,
  "show_hsmtm": false,
  "show_hsmtQ": false,
  "show_hsmtY": false,
  "hsmtMo_clr": "#100607ff",
  "hsmtW_clr": "#068ff1ff",
  "hsmtD_clr": "#ec7906ff",
  "hsmtN_clr": "#a417d3ff",
  "hsmtm_clr": "#006064ff",
  "hsmtQ_clr": "#b2ff59ff",
  "hsmtY_clr": "#f20814ff",
  "smt_txt_all": "#363a458a",
  "normstyle": "solid",
  "hiddstyle": "dashed",
  "al1ok": true,
  "al2ok": true,
  "al3ok": true,
  "al4ok": true,
  "al_con1": "W Bull SSMT",
  "al_con3": "90m Bull SSMT",
  "bl_con1": "W Bear SSMT",
  "bl_con3": "90m Bear SSMT",
  "cl_con1": "D Bull SSMT",
  "cl_con3": "Mic Bull SSMT",
  "dl_con1": "D Bear SSMT",
  "dl_con3": "Mic Bear SSMT",
  "triad_selection_mode": "Auto",
  "enable_m1": false,
  "st1_m1": "",
  "st2_m1": "",
  "st3_m1": "",
  "inv_m1": false,
  "enable_m2": false,
  "st1_m2": "",
  "st2_m2": "",
  "st3_m2": "",
  "inv_m2": false,
  "enable_m3": false,
  "st1_m3": "",
  "st2_m3": "",
  "st3_m3": "",
  "inv_m3": false,
  "enable_m4": false,
  "st1_m4": "",
  "st2_m4": "",
  "st3_m4": "",
  "inv_m4": false,
  "showsmt1": true,
  "showsmt2": true,
  "dyad_selection_mode": "Off",
  "enable_dyad_m1": false,
  "dyad_m1_sym1": "",
  "dyad_m1_sym2": "",
  "inv_dyad_m1": false,
  "enable_dyad_m2": false,
  "dyad_m2_sym1": "",
  "dyad_m2_sym2": "",
  "inv_dyad_m2": false,
  "enable_dyad_m3": false,
  "dyad_m3_sym1": "",
  "dyad_m3_sym2": "",
  "inv_dyad_m3": false,
  "enable_dyad_m4": false,
  "dyad_m4_sym1": "",
  "dyad_m4_sym2": "",
  "inv_dyad_m4": false,
  "tz": "UTC-4",
  "badj": false,
  "dayStartHour": 18,
  "show_qcisd": false,
  "bias_input": "Bullish",
  "qcisd_max_limit": 10,
  "qcisd_width": 2,
  "qcisd_mono": false,
  "qcisd_lbl_size_str": "Small",
  "qcisd_bull_clr": "#00E676ff",
  "qcisd_bear_clr": "#FF5252ff",
  "qcisd_pend_clr": "#FFEA00ff",
  "qcisd_text_clr": "#615e5ea6",
  "qcisd_trigger": "All",
  "qcisd_norm_trigger": "Off",
  "qt_show_sess": true,
  "qt_show_90": true,
  "qt_show_22": true,
  "qt_show_lbl_main": false,
  "qt_show_fill": true,
  "qt_fill_transp": 95,
  "qt_show_out_sess": true,
  "qt_show_out_90": true,
  "qt_show_out_22": true,
  "qt_bord_transp": 80,
  "qt_line_style": "Dotted",
  "qt_gap_min": 1,
  "qt_c_lbl_text": "#878686",
  "qt_use_mono_in": false,
  "qt_box_hist_days": 7,
  "qt_tf_box_max": "15",
  "qt_c_asia_m": "#ced7df63",
  "qt_c_asia_90": "#c2ccd4b2",
  "qt_c_asia_22": "#a4aaae66",
  "qt_b_asia_m": "#b2b9bf40",
  "qt_b_asia_90": "#afb7beb2",
  "qt_b_asia_22": "#989ea466",
  "qt_c_lon_m": "#c6bfbf5e",
  "qt_c_lon_90": "#ff52526e",
  "qt_c_lon_22": "#a0969666",
  "qt_b_lon_m": "#c2baba66",
  "qt_b_lon_90": "#ff525282",
  "qt_b_lon_22": "#87848466",
  "qt_c_nyam_m": "#929a9257",
  "qt_c_nyam_90": "#9e4caf61",
  "qt_c_nyam_22": "#989c9866",
  "qt_b_nyam_m": "#9da79d57",
  "qt_b_nyam_90": "#db85ee7a",
  "qt_b_nyam_22": "#9fa59f66",
  "qt_c_nypm_m": "#b8b5b166",
  "qt_c_nypm_90": "#33b0ef73",
  "qt_c_nypm_22": "#a3a19d66",
  "qt_b_nypm_m": "#b8b4b059",
  "qt_b_nypm_90": "#5799d263",
  "qt_b_nypm_22": "#8d8b8866",
  "qt_show_div": true,
  "qt_div_time": "Day Open (18:00)",
  "qt_c_div": "#8f9096b8",
  "qt_s_div": "Dotted",
  "qt_lim_div": 3,
  "qt_htf_cnt": 2,
  "qt_htf_style": "Dotted",
  "qt_show_y": false,
  "qt_c_y": "#f2364580",
  "qt_show_m": false,
  "qt_c_m": "#093fef80",
  "qt_show_w": true,
  "qt_c_w": "#2196f380",
  "qt_i_max_keep": 1,
  "qt_i_unlimited": false,
  "qt_i_l_style": "Dotted",
  "qt_i_t_size": "Small",
  "qt_i_offset": 0,
  "qt_s1_on": false,
  "qt_s1_name": "8:30",
  "qt_s1_start": "08:30",
  "qt_s1_end": "10:00",
  "qt_s1_col": "#787b86ff",
  "qt_s2_on": true,
  "qt_s2_name": "9:30",
  "qt_s2_start": "09:30",
  "qt_s2_end": "11:59",
  "qt_s2_col": "#787b86ff",
  "qt_s3_on": false,
  "qt_s3_name": "Slot3",
  "qt_s3_start": "07:30",
  "qt_s3_end": "11:59",
  "qt_s3_col": "#787b86ff",
  "qt_s4_on": false,
  "qt_s4_name": "Slot4",
  "qt_s4_start": "10:00",
  "qt_s4_end": "11:00",
  "qt_s4_col": "#787b86ff",
  "to_offset_val": 10,
  "to_textSize": "small",
  "to_use_mono": false,
  "to_style_mode": "Auto",
  "to_custom_style": "Solid",
  "to_hist_count_global": 1,
  "to_hist_yr": false,
  "to_hist_qt": false,
  "to_hist_mn": false,
  "to_hist_wk": false,
  "to_hist_dy": false,
  "to_hist_sess": false,
  "to_hist_90m": false,
  "to_show_yr_open": true,
  "to_show_qt_open": true,
  "to_show_mn_open": true,
  "to_show_wk_open": true,
  "to_show_dy_open": true,
  "to_show_sess_open": true,
  "to_show_90m_open": true,
  "to_nm_min": "1",
  "to_nm_max": "3",
  "to_sess_min": "1",
  "to_sess_max": "45",
  "to_dy_min": "1",
  "to_dy_max": "60",
  "to_wk_min": "15",
  "to_wk_max": "60",
  "to_mn_min": "60",
  "to_mn_max": "240",
  "to_qt_min": "240",
  "to_qt_max": "W",
  "to_yr_min": "240",
  "to_yr_max": "M",
  "to_c_yr": "#ff5252a6",
  "to_n_yr": "TYO",
  "to_c_qt": "#ff0066a3",
  "to_n_qt": "TQO",
  "to_c_mn": "#545754ff",
  "to_n_mn": "TMO",
  "to_c_wk": "#2195f396",
  "to_n_wk": "TWO",
  "to_c_dy": "#403f37a8",
  "to_n_dy": "TDO",
  "to_c_90m": "#00bbd4a8",
  "to_c_sess": "#9b27b0a3",
  "to_sess_lbl_mode": "Time",
  "to_show_table": true,
  "to_table_pos": "bottom_right",
  "to_table_txt_size": "small",
  "to_tbl_show_90m": true,
  "to_tbl_show_sess": true,
  "to_tbl_show_dy": true,
  "to_tbl_show_wk": true,
  "to_tbl_show_mn": false,
  "to_tbl_show_qt": false,
  "to_tbl_show_yr": false,
  "to_c_tbl_above": "#1090f9a3",
  "to_c_tbl_below": "#c8452bab",
  "to_c_tbl_none": "#787b86ff",
  "i_show_nano": false,
  "i_show_micro": true,
  "i_show_m90": true,
  "i_show_daily": true,
  "i_show_weekly": true,
  "i_show_monthly": false,
  "i_show_yearly": false,
  "i_hist": 25,
  "i_seqlbl_show": true,
  "i_seqlbl_pos": "Top",
  "i_seqlbl_size": "Small",
  "i_min_chain": 3,
  "i_hl_on": false,
  "i_hl_style": "Cell colour only",
  "i_chain_col": "#ffeb3b",
  "i_chain_transp": 60,
  "i_col_q1": "#787b86",
  "i_col_q2": "#f23645",
  "i_col_q3": "#4caf50",
  "i_col_q4": "#2196f3",
  "i_col_q0": "#ff9800",
  "i_q_transp": 10,
  "i_nc_transp": 75,
  "i_col_border": "#787b86ff",
  "i_col_369": "#9c27b0ff",
  "i_txt_col": "#ffffff",
  "i_show_bg": true,
  "i_vlines": false,
  "i_col_vline": "#787b86b2",
  "i_show_qnum": true,
  "i_pure_only": false,
  "i_bridge": true,
  "i_seqtxt_nano": true,
  "i_seqtxt_micro": true,
  "i_seqtxt_m90": true,
  "i_seqtxt_daily": true,
  "i_seqtxt_weekly": true,
  "i_seqtxt_monthly": true,
  "i_seqtxt_yearly": true,
  "i_show_labels": true,
  "i_label_color": "#787b86ff",
  "i_label_size": "Small",
  "QS_TZ": "America/New_York",
  "i_pref_nano": "1-1-1,2-2-2,3-3-3,4-4-4",
  "i_pref_micro": "1-1-1,2-2-2,3-3-3,4-4-4",
  "i_pref_m90": "1-1-1,2-2-2,3-3-3,4-4-4",
  "i_pref_daily": "1-1-1,2-2-2,3-3-3,4-4-4",
  "i_pref_weekly": "1-1-1,2-2-2,3-3-3,4-4-4",
  "i_pref_monthly": "1-1-1,2-2-2,3-3-3,4-4-4",
  "i_pref_yearly": "1-1-1,2-2-2,3-3-3,4-4-4",
  "i_hp_on": true,
  "i_hp_list": "1-1-1,1-1-4,1-2-3,1-3-2,1-4-1,1-4-4,2-1-3,2-2-2,2-3-1,2-3-4,2-4-3,3-1-2,3-2-1,3-2-4,3-3-3,3-4-2,4-1-1,4-1-4,4-2-3,4-3-2,4-4-1,4-4-4",
  "i_incl_next": true,
  "i_only_pref": false,
  "i_mark_369": false,
  "i_369_pref": false,
  "i_fri_q4": false,
  "i_tbl_show": true,
  "i_tbl_pos": "Bottom Right",
  "i_tbl_size": "Small",
  "i_proj_show": true,
  "i_proj_max": 8
};
  const DUR={'1m':60,'5m':300,'15m':900,'1h':3600,'4h':14400,'6h':21600,D:86400,W:604800};
  const timeframes=s=>DUR[s]||(/M$/.test(s)?parseFloat(s)*2629800:/W$/.test(s)?parseFloat(s)*604800:/D$/.test(s)?parseFloat(s)*86400:parseFloat(s)*60);
  const short=s=>String(s).split(':').pop(), finite=Number.isFinite;
  const styles=s=>String(s||'solid').toLowerCase();
  const formats=new Map(),cache=new Map();
  function parts(t,zone='America/New_York') {
    const key=zone+':'+t;if(cache.has(key))return cache.get(key);
    let p;
    const fixed=/^UTC([+-])(\d+)(?::(\d+))?$/.exec(zone);
    if(fixed||zone==='UTC') {
      const delta=fixed?(fixed[1]==='+'?1:-1)*(+fixed[2]*3600+(+fixed[3]||0)*60):0,d=new Date((t+delta)*1000);
      p={year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:d.getUTCHours(),minute:d.getUTCMinutes(),second:d.getUTCSeconds()};
    } else {
      if(!formats.has(zone))formats.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
      p=Object.fromEntries(formats.get(zone).formatToParts(new Date(t*1000)).filter(p=>p.type!=='literal').map(p=>[p.type,+p.value]));
    }
    p.dow=new Date(Date.UTC(p.year,p.month-1,p.day)).getUTCDay();
    if(cache.size>=30000)cache.clear();cache.set(key,p);return p;
  }
  function wall(y,m,d,h=0,mi=0,zone='America/New_York') {
    const target=Date.UTC(y,m-1,d,h,mi)/1000;let t=target;
    for(let i=0;i<4;i++){const p=parts(t,zone),diff=target-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)/1000;t+=diff;if(!diff)break;}return t;
  }
  function isoWeek(t,zone) {
    const p=parts(t,zone),d=new Date(Date.UTC(p.year,p.month-1,p.day));d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
    return {year:d.getUTCFullYear(),week:Math.ceil((((d-new Date(Date.UTC(d.getUTCFullYear(),0,1)))/86400000)+1)/7)};
  }
  function smtPhases(t,s) {
    const p=parts(t,s.tz),today=wall(p.year,p.month,p.day,s.dayStartHour,0,s.tz),day=t>=today?today:today-86400,a=parts(day,s.tz),delta=t-day;
    const w=isoWeek(day+86400,s.tz),jan=new Date(Date.UTC(w.year,0,1)),leap=w.year%4===0&&(w.year%100!==0||w.year%400===0),weeks=jan.getUTCDay()===4||(jan.getUTCDay()===3&&leap)?53:52;
    const month=weeks===53?(w.week===1?5:((w.week-2)%4)+1):((w.week-1)%4)+1;
    return {day,values:[Math.floor(delta/1350)%64,Math.floor(delta/5400)%16,Math.floor(delta/21600)%4,a.dow,month-1,(a.month-1)%3,Math.floor((a.month-1)/3)]};
  }
  const line=(a,b,color,style='solid',width=1)=>({type:'line',p1:a,p2:b,borderColor:color,lineStyle:styles(style),width});
  const label=(time,price,text,color,size=10,horizontal='center',vertical='inside')=>({type:'text',p1:{time,price},text,textStyle:{color,size,horizontal,vertical}});
  function market(context,symbol,tf) {
    const entry=Object.entries(context.markets||{}).find(([k])=>short(k)===short(symbol))?.[1];
    if(context.peerBars?.[short(symbol)]&&tf===context.timeframe)return context.peerBars[short(symbol)];
    if(entry?.[tf]?.length)return entry[tf];
    if(entry?.['1m']?.length&&typeof MarketData!=='undefined')return MarketData.aggregate(entry['1m'],tf,entry.metadata);
    return [];
  }
  function tick(state,b,phase) {
    if(!b)return;
    if(state.phase!==phase) {state.prev=state.cur||extreme(b);state.cur=extreme(b);state.phase=phase;}
    else {
      const c=state.cur;
      for(const [key,val] of [['hi',b.high],['lo',b.low],['bh',Math.max(b.open,b.close)],['bl',Math.min(b.open,b.close)]])
        if(key==='hi'||key==='bh'?val>=c[key]:val<=c[key]){c[key]=val;c[key+'At']=b.time;}
    }
  }
  function extreme(b) {return {hi:b.high,lo:b.low,bh:Math.max(b.open,b.close),bl:Math.min(b.open,b.close),hiAt:b.time,loAt:b.time,bhAt:b.time,blAt:b.time};}
  function disagree(a,b,c,d,inverse) {if(![a,b,c,d].every(finite))return false;return (inverse?(a>=b&&c>=d)||(a<=b&&c<=d):(a>=b&&c<=d)||(a<=b&&c>=d))&&!(a===b&&c===d);}
  const defs=[['m','Micro','Mic.',300,60,120],['N','90m','90m',600,180,600],['D','Daily','D',1800,900,1800],['W','Weekly','W',10800,3600,10800],['Mo','Monthly','M',21600,10800,21600],['Q','Quarterly','Q',86400,86400,86400],['Y','Yearly','Y',2629800,604800,604800]];
  function correlation(symbol,s) {
    const own=short(symbol),root=own.replace(/[12]!$/,'');
    if(s.triad_selection_mode!=='Auto'||s.dyad_selection_mode!=='Off')throw Error('QT+ JS hiện hỗ trợ Auto NQ/ES/YM; chưa port Manual/Dyad của AssetCorrelationUtils/8.');
    if(!['NQ','ES','YM','MNQ','MES','MYM'].includes(root))throw Error('Chưa có source AssetCorrelationUtils/8: Auto hiện chỉ hỗ trợ NQ/ES/YM và micro tương ứng.');
    if(s.badj)throw Error('B-ADJ cần dữ liệu điều chỉnh thật từ nguồn; bản JS không tự sửa giá.');
    const family=root.startsWith('M')?['MNQ1!','MES1!','MYM1!']:['NQ1!','ES1!','YM1!'];
    return family.filter(x=>x!==own);
  }
  function runSmt(bars,context,s,drawings,tables,events,warnings) {
    const seconds=context.timeframeSeconds||timeframes(context.timeframe),pair=correlation(context.symbol,s);
    const maps=pair.map(name=>new Map(market(context,name,context.timeframe).map(b=>[b.time,b])));
    maps.forEach((m,i)=>{if(!bars.some(b=>m.has(b.time)))warnings.push(`Thiếu nến ${pair[i]} trùng giờ; không tính SSMT peer này`);});
    const frames=defs.map(()=>({own:{},peers:[{},{}],signals:Array.from({length:4},()=>[false,false]),lines:Array.from({length:4},()=>[[],[]])}));
    const qc=[],psp=[],colors=[],byTime=new Map(bars.map((b,i)=>[b.time,{...b,index:i}]));
    for(let index=0;index<bars.length;index++) {
      const bar=bars[index],ph=smtPhases(bar.time,s),peer=maps.map(m=>m.get(bar.time));
      frames.forEach((f,i)=>{
        const [key,name,caption,max,minVis,maxVis]=defs[i];if(seconds>max)return;
        const phase=ph.values[i],changed=f.own.phase!==phase;
        tick(f.own,bar,phase);peer.forEach((b,j)=>tick(f.peers[j],b,phase));
        const a=f.own.cur,ap=f.own.prev,visible=s.modeltype==='Auto'?seconds>=minVis&&seconds<=maxVis:seconds<=maxVis;
        for(let j=0;j<2;j++) {
          if(!peer[j]||!(j?s.showsmt2:s.showsmt1))continue;
          const b=f.peers[j].cur,bp=f.peers[j].prev;
          if(!ap||!b||!bp)continue;
          for(let k=0;k<4;k++) {
            const hidden=k>=2,bull=k%2===1,v=hidden?(bull?'bl':'bh'):(bull?'lo':'hi'),list=f.lines[k][j];
            const on=(hidden?s['show_hsmt'+key]:s['show_smt'+key])&&(hidden?s.alerttype!=='Normal':s.alerttype!=='Hidden');
            const signal=disagree(ap[v],a[v],bp[v],b[v],false),prev=f.signals[k][j];
            const lastAt=f.lastAt?.[k],moved=lastAt!==a[v+'At'];
            if(on&&signal&&(changed||!prev||moved)) {
              list.push({a:{time:ap[v+'At'],price:ap[v]},b:{time:a[v+'At'],price:a[v]},created:bar.time});
              if(list.length>s.ssmt_history_limit)list.shift();
            }
            if(on&&!changed&&prev&&!signal)list.pop();
            for(let z=list.length-1;z>=0;z--)if(bar.time>list[z].b.time&&(bull?(hidden?Math.min(bar.open,bar.close):bar.low)<=list[z].b.price:(hidden?Math.max(bar.open,bar.close):bar.high)>=list[z].b.price))list.splice(z,1);
            if(!hidden&&on&&s.show_qcisd&&visible&&signal&&(!prev||moved)) {
              const pivot=byTime.get(a[v+'At']),prior=pivot&&bars[pivot.index-1];
              if(pivot) {
                const currentBody=bull?pivot.close<pivot.open:pivot.close>pivot.open;
                const lvl=currentBody?pivot.open:prior?.open,start=currentBody?pivot.time:pivot.time-seconds;
                const hp=s.bias_input===(bull?'Bullish':'Bearish');
                if(finite(lvl)&&!qc.some(x=>x.bull===bull&&x.name===name&&x.start===start&&x.hp===hp)) {
                  for(let z=qc.length-1;z>=0;z--)if(qc[z].bull===bull&&qc[z].name===name&&(moved||qc[z].start===start))qc.splice(z,1);
                  qc.push({bull,name,caption,start,lvl,hp,confirmed:bull?bar.close>lvl:bar.close<lvl,peer:pair[j]});
                }
              }
            }
            f.signals[k][j]=signal;
          }
        }
        f.lastAt=['hi','lo','bh','bl'].map(v=>a[v+'At']);f.visible=visible;f.day=ph.day;
      });
      while(qc.length>s.qcisd_max_limit)qc.shift();
      for(let z=qc.length-1;z>=0;z--) {
        const q=qc[z],confirm=q.bull?bar.close>q.lvl:bar.close<q.lvl;
        const wrong=b=>b&&(q.bull?Math.max(b.close,b.open)<q.lvl:Math.min(b.close,b.open)>q.lvl);
        if(confirm&&!q.confirmed){q.confirmed=true;events.push({time:bar.time,type:'qcisdConfirm',tier:q.name});}
        if(wrong(bar)&&wrong(bars[index-1])&&wrong(bars[index-2])){events.push({time:bar.time,type:'qcisdInvalidation',tier:q.name});qc.splice(z,1);continue;}
        q.pending=wrong(bar);
        if(confirm&&(q.bull?bar.low<=q.lvl:bar.high>=q.lvl))events.push({time:bar.time,type:'qcisdRetest',tier:q.name});
      }
      if(s.use_psp_adv&&seconds>=timeframes(s.psp_vis_limit)) {
        const dir=Math.sign(bar.close-bar.open),crack=dir&&peer.some((b,j)=>b&&(j?s.showsmt2:s.showsmt1)&&Math.sign(b.close-b.open)&&Math.sign(b.close-b.open)!==dir);
        if(crack) {
          if(s.psp_mode!=='Body Only'){psp.push(label(bar.time,dir>0?bar.low:bar.high,dir>0?s.psp_bull_shape:s.psp_bear_shape,dir>0?s.psp_bull_clr:s.psp_bear_clr,10,'center',dir>0?'below':'above'));if(psp.length>s.max_psp_bars)psp.shift();}
          if(s.psp_mode!=='Icons Only')colors.push({time:bar.time,color:dir>0?s.psp_bull_body:s.psp_bear_body});
        }
      }
    }
    frames.forEach((f,i)=>{
      const key=defs[i][0];if(!f.visible)return;
      for(let k=0;k<4;k++)for(let j=0;j<2;j++)for(const item of f.lines[k][j]) {
        const color=s[(k>=2?'hsmt':'smt')+key+'_clr'];
        if(!s.hidelines)drawings.push(line(item.a,item.b,color,k>=2?s.hiddstyle:s.normstyle));
        if(!s.hidelabels)drawings.push(label((item.a.time+item.b.time)/2,(item.a.price+item.b.price)/2,defs[i][2]+(k>=2?' (hd) ':' ')+pair[j],s.smt_txt_all));
      }
    });
    const last=bars.at(-1);
    if(last)for(const q of qc) {
      const end=last.time+seconds*10,color=q.pending?s.qcisd_pend_clr:q.bull?s.qcisd_bull_clr:s.qcisd_bear_clr;
      drawings.push(line({time:q.start,price:q.lvl},{time:end,price:q.lvl},color,q.confirmed?'solid':'dashed',s.qcisd_width),label(end,q.lvl,`${q.bull?'(+)':'(-)'} ${q.hp?'HP ':''}${q.caption}_QCISD`,s.qcisd_text_clr,10,'left'));
    }
    drawings.push(...psp);
    if(s.show_sbar_st) {
      const row=[];
      for(const i of [6,5,4,3,2,1,0]) {
        const key=['mic','90m','d','w','m','q','y'][i];if(!s['sb_show_'+key])continue;
        const f=frames[i],limit=i<=1?f.day:0,bear=f.lines[0].flat().some(x=>x.b.time>=limit),bull=f.lines[1].flat().some(x=>x.b.time>=limit);
        row.push({text:defs[i][2],color:bull&&bear?s.c_sb_sand:bull?s.c_sb_bull:bear?s.c_sb_bear:s.c_sb_neut});
      }
      tables.push({title:'',position:s.sbar_pos_in,rows:[row]});
    }
    return colors;
  }
  function runCycles(bars,context,s,drawings) {
    const sec=context.timeframeSeconds||timeframes(context.timeframe), boxes=[[],[],[]],divs={y:[],m:[],w:[],d:[]},slotLines=Array.from({length:4},()=>[]);
    let previous,weekPrinted=false;
    const append=(arr,x,n)=>{arr.push(x);if(arr.length>n)arr.shift();};
    for(const b of bars) {
      const p=parts(b.time),hour=Math.floor(p.hour/6)*6,start=wall(p.year,p.month,p.day,hour),area=p.hour>=18?'asia':p.hour<6?'lon':p.hour<12?'nyam':'nypm';
      const div=(key,color,style,n)=>append(divs[key],{...line({time:b.time,price:b.low},{time:b.time,price:b.high},color,style),axis:'vertical'},n);
      if(p.dow===5)weekPrinted=false;
      if(s.qt_show_y&&previous&&previous.year!==p.year)div('y',s.qt_c_y,s.qt_htf_style,s.qt_htf_cnt);
      if(s.qt_show_m&&sec<=604800&&previous&&previous.month!==p.month)div('m',s.qt_c_m,s.qt_htf_style,s.qt_htf_cnt);
      if(s.qt_show_w&&sec<=3600&&p.dow===0&&p.hour>=18&&!weekPrinted){div('w',s.qt_c_w,s.qt_htf_style,s.qt_htf_cnt);weekPrinted=true;}
      if(s.qt_show_div&&sec<=3600&&p.hour===(s.qt_div_time==='Midnight (00:00)'?0:18)&&previous?.hour!==p.hour)div('d',s.qt_c_div,s.qt_s_div,s.qt_lim_div);
      if(sec<=timeframes(s.qt_tf_box_max))for(let i=0;i<3;i++) {
        const suffix=['m','90','22'][i],toggle=['sess','90','22'][i],span=[21600,5400,1350][i],limit=[s.qt_box_hist_days*4,Math.min(s.qt_box_hist_days,10)*16,Math.min(s.qt_box_hist_days,3)*64][i];
        if(!s['qt_show_'+toggle])continue;
        const left=start+Math.floor((b.time-start)/span)*span,arr=boxes[i];let box=arr.at(-1);
        if(!box||box.p1.time!==left) {
          box={type:'box',p1:{time:left,price:b.high},p2:{time:b.time,price:b.low},borderColor:s['qt_b_'+area+'_'+suffix].slice(0,7),fillColor:s['qt_c_'+area+'_'+suffix].slice(0,7),fillEnabled:s.qt_show_fill,fillOpacity:100-s.qt_fill_transp,strokeOpacity:s['qt_show_out_'+toggle]?100-s.qt_bord_transp:0,lineStyle:styles(s.qt_line_style),middleLine:{enabled:false}};
          append(arr,box,limit);
          if(i===0&&s.qt_show_lbl_main)box.text=['London','NY AM','NY PM','Asia'][hour/6];
        }
        box.p2.time=Math.min(b.time,left+span-s.qt_gap_min*60);box.p1.price=Math.max(box.p1.price,b.high);box.p2.price=Math.min(box.p2.price,b.low);
      }
      for(let i=0;i<4;i++) {
        const n=i+1,arr=slotLines[i],startText=s[`qt_s${n}_start`],endText=s[`qt_s${n}_end`];
        const minute=x=>{const v=x.replace(':','').padStart(4,'0');return +v.slice(0,2)*60+ +v.slice(2);};
        const a=minute(startText),z=minute(endText),at=p.hour*60+p.minute,inside=a<z?at>=a&&at<z:at>=a||at<z;
        if(!s[`qt_s${n}_on`]||sec>3600||(sec===3600&&a%60))continue;
        const was=arr._inside;
        if(inside&&!was)append(arr,{start:b.time,end:b.time,price:b.open},s.qt_i_unlimited?500:s.qt_i_max_keep);
        if(inside&&arr.length)arr.at(-1).end=b.time;
        arr._inside=inside;
      }
      previous=p;
    }
    drawings.push(...boxes.flat(),...Object.values(divs).flat());
    slotLines.forEach((arr,i)=>arr.forEach(x=>{const color=s[`qt_s${i+1}_col`];drawings.push(line({time:x.start,price:x.price},{time:x.end,price:x.price},color,s.qt_i_l_style),label(x.end+s.qt_i_offset*sec,x.price,s[`qt_s${i+1}_name`],color,10,'left'));}));
  }
  function trueOpens(bars,context,s,drawings,tables,warnings) {
    if(!bars.length)return;
    const sec=context.timeframeSeconds||timeframes(context.timeframe),last=bars.at(-1),cutoff=last.time,events=[];
    const meta=context.metadata||{},exchangeZone=meta.timezone||'America/Chicago';
    const period=(key,time)=>{
      const p=parts(time,exchangeZone);
      if(key==='yr')return String(p.year);
      if(key==='qt')return p.year+':'+Math.floor((p.month-1)/3);
      if(key==='mn')return p.year+':'+p.month;
      if(key==='wk'&&typeof MarketData!=='undefined')return String(MarketData.bucket(time,'W',meta));
      return null;
    };
    for(const [key,tf] of [['yr','W'],['qt','D'],['mn','4h'],['wk','1h'],['dy','1m'],['sess','1m'],['90m','1m']]) {
      if(!s['to_show_'+key+'_open'])continue;
      const source=market(context,context.symbol,tf).filter(b=>b.time<=cutoff);
      if(!source.length){warnings.push(`True Open ${key}: thiếu ${tf}`);continue;}
      let prior,lastToken;
      for(const b of source) {
        const p=parts(b.time),ex=parts(b.time,exchangeZone);let trigger=false,token,name=s['to_n_'+key]||key,end=0;
        if(key==='yr'){trigger=ex.month===4&&prior!==undefined&&prior.month!==4;token=ex.year;}
        if(key==='qt') {
          const qm=Math.floor((ex.month-1)/3)*3+1,first=parts(wall(ex.year,qm,1,0,0,exchangeZone),exchangeZone),fourth=1+(7-first.dow)%7+21;
          trigger=b.time>=wall(ex.year,qm,fourth,0,0,exchangeZone);token=ex.year+':'+qm;
        }
        if(key==='mn'){trigger=p.day>=7&&p.day<=13&&p.dow===0&&(p.hour===18||(p.hour>18&&(prior?.hour??99)<18));token=p.year+':'+p.month;}
        if(key==='wk'){trigger=p.dow===1&&p.hour===18&&p.minute===0;token=b.time;}
        if(key==='dy'){trigger=p.hour===0&&p.minute===0;token=p.year+':'+p.month+':'+p.day;}
        if(key==='sess') {
          const index=[[19,30,'AO'],[1,30,'LO'],[7,30,'NYO[AM]'],[13,30,'NYO[PM]']].find(x=>p.hour===x[0]&&p.minute===x[1]);
          if(index){trigger=true;name=index[2];end=p.hour>=18?wall(p.year,p.month,p.day,0)+86400:wall(p.year,p.month,p.day,Math.floor(p.hour/6)*6+6);}token=b.time;
        }
        if(key==='90m'){trigger=p.hour%3===0&&p.minute===23||p.hour%3===1&&p.minute===53;token=b.time;end=p.hour%3===0?wall(p.year,p.month,p.day,p.hour+1,30):wall(p.year,p.month,p.day,p.hour+2,0);name='90m';}
        if(trigger&&token!==lastToken){events.push({key,time:b.time,price:b.open,name,end});lastToken=token;}
        prior=key==='yr'||key==='qt'?ex:p;
      }
    }
    const keys=['yr','qt','mn','wk','dy','sess','90m'],rows=[];
    for(const key of keys) {
      const all=events.filter(x=>x.key===key),latest=all.at(-1),current=latest&&period(key,latest.time)===period(key,cutoff)?latest:undefined,range=key==='90m'?'nm':key,vis=sec>=timeframes(s['to_'+range+'_min'])&&sec<=timeframes(s['to_'+range+'_max']);
      const retained=s['to_hist_'+key]?all.slice(-(s.to_hist_count_global+1)):all.slice(-1);
      if(vis)retained.forEach((x,i)=>{
        const active=x===current,next=all[all.indexOf(x)+1];
        if(!active&&!s['to_hist_'+key])return;
        const boundary=period(key,x.time)===null?undefined:bars.find(b=>b.time>x.time&&period(key,b.time)!==period(key,x.time))?.time;
        const edge=active?Math.min(last.time+s.to_offset_val*sec,x.end||Infinity):Math.min(next?.time||boundary||last.time,x.end||Infinity);
        const color=s['to_c_'+key]||s.to_c_90m,style=s.to_style_mode==='Auto'?(active?'dotted':'solid'):styles(s.to_custom_style);
        drawings.push(line({time:x.time,price:x.price},{time:edge,price:x.price},color,style));
        if(active){const p=parts(x.time),text=(key==='sess'&&s.to_sess_lbl_mode==='Time'||key==='90m')?`${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`:x.name;drawings.push(label(edge,x.price,text,color,10,'left'));}
      });
      if(s['to_tbl_show_'+key])rows.push([current?.name||s['to_n_'+key]||key,current?current.price.toFixed(2):'—',current?(last.close>current.price?'Above':last.close<current.price?'Below':'At'):'Not Open']);
    }
    if(s.to_show_table)tables.push({title:'True Opens · observed history',position:s.to_table_pos,rows});
  }
  function phaseSet(t,s,forcedMs) {
    const p=parts(t,s.QS_TZ),ms=forcedMs??(((p.hour*3600+p.minute*60+p.second-64800+86400)%86400)*1000);
    const sd=p.dow+1+(p.hour>=18?1:0),weekly=sd>=2&&sd<=5?sd-1:sd===6&&s.i_fri_q4?4:0;
    const anchor=(y,m)=>{const d=parts(wall(y,m,1,12,0,s.QS_TZ),s.QS_TZ).dow;return wall(y,m,1+(8-d)%7,18,0,s.QS_TZ)-86400;};
    let start=anchor(p.year,p.month);
    if(t<start)start=anchor(p.year,p.month-1);else if(t>=anchor(p.year,p.month+1))start=anchor(p.year,p.month+1);
    return {ms,ph:[Math.floor(ms%1350000/337500)+1,Math.floor(ms%5400000/1350000)+1,Math.floor(ms%86400000/5400000)%4+1,Math.floor(ms%86400000/21600000)+1,weekly,Math.min(Math.floor((t-start)/604800)+1,4),Math.floor((p.month-1)/3)+1,({3:1,0:2,1:3,2:4})[p.year%4]]};
  }
  function ribbon(bars,context,s,tables,events) {
    const sec=context.timeframeSeconds||timeframes(context.timeframe),keys=['nano','micro','m90','daily','weekly','monthly','yearly'],names=['Nano','Micro','90M','Daily','Weekly','Monthly','Yearly','Chain'];
    const on=keys.map((k,i)=>s['i_show_'+k]&&sec<=[60,300,3600,14400,21600,14400,604800][i]&&(i!==6||sec>=900));on.push(s.i_hl_on&&s.i_hl_style==='Separate ribbon row');
    const visible=on.map((x,i)=>x?i:-1).filter(x=>x>=0),count=Math.max(1,visible.length),lanes=Array.from({length:8},()=>[]),drawings=[];
    const prefs=text=>new Set(text.split(',').map(x=>x.trim())),hp=prefs(s.i_hp_list),per=keys.map(k=>prefs(s['i_pref_'+k]));
    const state=(t,ms)=>{
      const ph=phaseSet(t,s,ms).ph,chains=Array(8).fill(0),ids=visible.filter(x=>x<7),pair=(a,b)=>a===b&&a>=1&&a<=4||s.i_bridge&&(a===4&&b===1||a===1&&b===4);
      for(let a=0;a<ids.length;){let b=a;while(b+1<ids.length&&pair(ph[ids[b]],ph[ids[b+1]]))b++;for(let i=a;i<=b;i++)chains[ids[i]]=b-a+1;a=b+1;}
      const longest=Math.max(...chains);chains[7]=longest>=s.i_min_chain?longest:0;
      return Array.from({length:8},(_,i)=>{
        if(i===7)return {phase:chains[7],seq:'',preferred:false,is369:false,chain:false};
        const digits=[ph[Math.min(i+2,7)],ph[Math.min(i+1,6)],ph[i]],seq=digits.join('-'),root=(digits.reduce((a,b)=>a+b,0)-1)%9+1,is369=root%3===0&&root>0;
        const next=[digits[0],digits[1],digits[2]-1].join('-');
        let preferred=(s.i_hp_on?hp.has(seq):per[i].has(seq)||s.i_incl_next&&digits[2]>1&&per[i].has(next))||s.i_369_pref&&is369;
        preferred=preferred&&(!s.i_pure_only||digits.every(x=>x===digits[0]));
        return {phase:ph[i],seq,preferred,is369,chain:chains[i]>=s.i_min_chain};
      });
    };
    const cell=(k,left,right,v,projected)=>{
      const pos=visible.indexOf(k),chain=k===7,col=k===7?s.i_chain_col:s['i_col_q'+v.phase];
      const filled=chain?v.phase>0:v.preferred||!s.i_only_pref&&s.i_show_bg;
      return {type:'box',p1:{time:left,price:100-pos*100/count},p2:{time:right,price:100-(pos+1)*100/count},fillEnabled:filled,fillColor:col,fillOpacity:100-(chain?s.i_chain_transp:v.preferred||s.i_hl_on&&v.chain?s.i_q_transp:s.i_nc_transp),borderColor:s.i_mark_369&&v.is369?s.i_col_369:s.i_hl_on&&s.i_hl_style==='Boxes'&&v.chain?s.i_chain_col:s.i_col_border,width:s.i_mark_369&&v.is369||s.i_hl_on&&s.i_hl_style==='Boxes'&&v.chain?2:1,lineStyle:projected?'dotted':'solid',middleLine:{enabled:false},text:chain?(v.phase?String(v.phase):''):s['i_seqtxt_'+keys[k]]?v.seq:s.i_show_qnum?'Q'+v.phase:'',textStyle:{color:s.i_txt_col,size:10,horizontal:'center',vertical:'inside'},_state:v};
    };
    let prior;
    const backgrounds=[];
    for(const b of bars) {
      const states=state(b.time);
      if(s.i_hl_on&&s.i_hl_style==='Background color'&&states[7].phase>0) {
        const last=backgrounds.at(-1);
        if(last&&last.p2.time===b.time)last.p2.time=b.time+sec;
        else backgrounds.push({type:'box',p1:{time:b.time,price:100},p2:{time:b.time+sec,price:0},fillColor:s.i_chain_col,fillOpacity:100-s.i_chain_transp,strokeOpacity:0,middleLine:{enabled:false}});
      }
      for(const k of visible) {
        const v=states[k],arr=lanes[k],old=arr.at(-1);
        if(!old||old._state.phase!==v.phase||old._state.seq!==v.seq) {
          if(old)old.p2.time=b.time;
          arr.push(cell(k,b.time,b.time,v,false));if(arr.length>s.i_hist)arr.shift();
          if(k<7&&v.preferred&&(!prior?.[k].preferred||prior[k].seq!==v.seq))events.push({time:b.time,type:'preferred',tier:names[k],sequence:v.seq});
        }
        arr.at(-1).p2.time=b.time;
      }
      if(states[7].phase>0&&!(prior?.[7].phase>0))events.push({time:b.time,type:'chainStarted'});
      if(!states[7].phase&&prior?.[7].phase)events.push({time:b.time,type:'chainEnded'});
      prior=states;
    }
    const last=bars.at(-1);
    if(last&&s.i_proj_show) {
      const {ms}=phaseSet(last.time,s),anchor=last.time-ms/1000,end=anchor+86400,grid=on[0]?337.5:on[1]?1350:on[2]?5400:21600;
      const current=prior.map(x=>({...x})),begins=Array(8).fill(last.time),first=Array(8).fill(true),n=Array(8).fill(0);
      const flush=(k,t)=>{
        if(first[k]){lanes[k].at(-1).p2.time=t;first[k]=false;}
        else if(n[k]<s.i_proj_max){drawings.push(cell(k,begins[k],t,current[k],true));n[k]++;}
      };
      for(let t=anchor+(Math.floor(ms/1000/grid)+1)*grid;t<end;t+=grid) {
        const future=state(t,(t-anchor)*1000);
        for(const k of visible)if(future[k].phase!==current[k].phase||future[k].seq!==current[k].seq){flush(k,t);current[k]=future[k];begins[k]=t;}
      }
      for(const k of visible)flush(k,end);
    }
    for(const k of visible)for(const box of lanes[k]) {
      drawings.push(box);
      if(s.i_vlines&&k<7)drawings.push(line(box.p1,{time:box.p1.time,price:box.p2.price},s.i_col_vline,'dotted'));
    }
    if(last) {
      if(s.i_show_labels)for(const k of visible)drawings.push(label(context.viewport?.from??last.time,100-(visible.indexOf(k)+.5)*100/count,names[k],s.i_label_color,10,'left'));
      const lowest=visible.find(x=>x<7);
      if(lowest!==undefined&&s.i_seqlbl_show) {
        const text=`${names[lowest]} ${prior[lowest].seq}${prior[lowest].preferred?' PREF':''}`;
        if(s.i_seqlbl_pos==='Corner')tables.push({title:'',pane:true,position:'Top Left',rows:[[text]]});
        else drawings.push(label(last.time,s.i_seqlbl_pos==='Bottom'?6:94,text,s.i_label_color,11,'left'));
      }
      if(s.i_tbl_show)tables.push({title:'Quarter Sequences',position:s.i_tbl_pos,pane:true,rows:[['Cycle','Quarter','Sequence','Flags'],...visible.filter(k=>k<7).reverse().map(k=>[names[k],'Q'+prior[k].phase,prior[k].seq,(prior[k].preferred?'PREF ':'')+(prior[k].is369?'369 ':'')+(prior[k].chain?'CHAIN':'')])]});
    }
    return {title:'QT+ Quarter Sequences',min:0,max:100,drawings:[...backgrounds,...drawings]};
  }
  function calculate(bars,context={}) {
    const s={...defaults,...context.settings};
    for(const key of Object.keys(context.settings||{}))if(!(key in defaults))throw Error('Tham số QT+ không tồn tại: '+key);
    for(const [key,min,max] of [['ssmt_history_limit',1,100],['qcisd_max_limit',1,50],['i_hist',1,250],['i_proj_max',1,60],['qt_box_hist_days',1,30],['i_min_chain',2,7],['dayStartHour',0,23]])if(!Number.isInteger(s[key])||s[key]<min||s[key]>max)throw Error(`${key}: ${min}–${max}`);
    const ctx={...context,timeframe:context.timeframe||'1m',symbol:context.symbol||'NQ1!'},drawings=[],tables=[],events=[],warnings=['QT+ JS thử nghiệm: chưa đối chiếu Pine; Auto chỉ NQ/ES/YM; alerts chưa nối host'];
    const colors=runSmt(bars,ctx,s,drawings,tables,events,warnings);
    runCycles(bars,ctx,s,drawings);trueOpens(bars,ctx,s,drawings,tables,warnings);
    const pane=ribbon(bars,ctx,s,tables,events);
    return {series:[],drawings,pane,tables,candleColors:colors,events,warnings};
  }
  return {name:'QT+ by 4XS · JavaScript test port',defaults,calculate,parts,wall,smtPhases,phaseSet,disagree};
})();
if(typeof module!=='undefined')module.exports=indicator;
