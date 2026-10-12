const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const calibration=require('./calibration.json');
function evidence(p) {
  const minutes=Math.max(0,Math.min(90,finite(p.recentMinutes,finite(p.minutes)/Math.max(1,finite(p.gamesPlayed,1)))));
  const fraction=minutes/90, position=p.element_type;
  const goals=finite(p.expected_goals_per_90), assists=finite(p.expected_assists_per_90), conceded=finite(p.expected_goals_conceded_per_90,1.5);
  const appearance=2*fraction;
  const attacking=fraction*(goals*({1:10,2:6,3:5,4:4}[position]||4)+assists*3);
  const clean=(position<=3?position===3?1:4:0)*Math.exp(-conceded)*Math.min(1,minutes/60);
  const saves=position===1?finite(p.saves_per_90)*fraction/3:0;
  const defensive=position>1?2*Math.min(1,finite(p.defensive_contribution_per_90)*fraction/(position===2?10:12)):0;
  const underlying=Math.max(0,appearance+attacking+clean+saves+defensive-(position<=2?conceded*fraction*0.3:0));
  const form=finite(p.form,finite(p.points_per_game));
  const estimate=(1-calibration.formWeight)*underlying+calibration.formWeight*form;
  return {minutes:Math.round(minutes),underlying,estimate,availability:p.chance_of_playing_next_round??100,confidence:minutes>=70?'medium':minutes>=40?'low':'very low',news:p.news||'',newsUpdatedAt:p.news_added||null};
}
module.exports={evidence};
