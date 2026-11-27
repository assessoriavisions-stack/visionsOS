/* ============================================================
   PORTAL DO CLIENTE — acesso com código (mesmos dados do sistema antigo)
   Abas: briefing, posts (aprovação), relatório, CRM, checklist, roteiro, mapas
   ============================================================ */
function ClientPortal({ clientId, onLogout, preview }) {
  const [clients, , loading] = useDoc(V6('clients'), []);
  const cl = asArr(clients).find(c => c.id === clientId);
  if (!preview) CURRENT_USER = { id: 'cliente', name: cl ? cl.name : 'Cliente', role: 'cl' };
  if (loading) return html`<div class="boot">Carregando seu portal…</div>`;
  if (!cl || cl.archived) return html`<div class="login"><div class="card"><${Empty} t="Acesso indisponível" s="Fale com a equipe Visions."><${Btn} on=${onLogout}>Voltar</${Btn}></${Empty}></div></div>`;
  return html`<div style=${{ minHeight: '100vh', background: 'var(--bg)' }}>
    <div class="top" style=${{ position: 'sticky' }}>
      <img src=${window.VOS_LOGO} alt="Visions" style=${{ height: 30 }}/>
      <div style=${{ minWidth: 0 }}><div class="ttl ellipsis">${cl.name}</div><div class="xs faint">Portal do cliente${preview ? ' · pré-visualização da equipe' : ''}</div></div>
      <span class="sp"/>
      <${Btn} sz="sm" v=${preview ? 'pri' : ''} icon=${preview ? 'x' : 'logout'} on=${onLogout}>${preview ? 'Fechar visualização' : 'Sair'}</${Btn}>
    </div>
    <div class="content"><${ClientWorkspace} id=${clientId} portal=${true} nav=${{ go: () => {}, client: () => {}, preview: () => {} }}/></div>
  </div>`;
}
