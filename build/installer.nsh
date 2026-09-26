!macro customRemoveFiles
  MessageBox MB_YESNO "Deseja apagar também todos os dados do sistema (histórico de vendas, produtos e fotos)?" IDYES apagar IDNO manter
  apagar:
    RMDir /r "$APPDATA\controle-comercio"
  manter:
!macroend