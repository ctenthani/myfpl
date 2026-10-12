function realised(selection,actual,positions){
  let xi=[...selection.xi];
  const bench=selection.squadIds.filter(id=>!xi.includes(id));
  const used=new Set();
  for(let index=0;index<xi.length;index++){
    if((actual[xi[index]]?.minutes||0)>0)continue;
    for(const replacement of bench){
      if(used.has(replacement)||!(actual[replacement]?.minutes>0)||(positions[replacement]===1)!==(positions[xi[index]]===1))continue;
      const candidate=xi.map((id,i)=>i===index?replacement:id),count=pos=>candidate.filter(id=>positions[id]===pos).length;
      if(count(1)!==1||count(2)<3||count(3)<2||count(4)<1)continue;
      xi=candidate;used.add(replacement);break;
    }
  }
  const captain=(actual[selection.captain]?.minutes||0)>0?selection.captain:(actual[selection.vice]?.minutes||0)>0?selection.vice:null;
  return xi.reduce((sum,id)=>sum+(actual[id]?.points||0),0)+(captain?actual[captain]?.points||0:0)-selection.hit;
}
module.exports={realised};
