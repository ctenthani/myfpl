const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('js/mission.js','utf8');
test('diagnostics require verified owner and disappear after logout or account failure',()=>{
 const nodes=[{hidden:true},{hidden:true}],window={myfplAccount:null};
 const context=vm.createContext({window,document:{querySelectorAll:()=>nodes},el:()=>({dataset:{loaded:'1'}})});
 vm.runInContext(source.slice(source.indexOf('  function ownerDiagnostics()'),source.indexOf('  function renderOwnerTeams()')),context);
 for(const account of [null,{signedIn:true,owner:false},{signedIn:false,owner:true},{signedIn:true,owner:true},null]){
  window.myfplAccount=account;context.ownerDiagnostics();assert.equal(nodes.every(n=>n.hidden),!(account?.signedIn===true&&account?.owner===true));
 }
});
