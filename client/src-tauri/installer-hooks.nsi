; インストール時に既存データがあれば削除を提案する
; （再インストール時も確実に動作する）
!macro customInstall
  IfFileExists "$APPDATA\net.smisann.mnemovr\*.*" 0 done
    MessageBox MB_YESNO "MnemoVR の既存データ（データベース・キャッシュ・設定）が見つかりました。$\n削除して初期状態にしますか？$\n$\n「いいえ」を選ぶとデータが引き継がれます。" IDNO done
      RMDir /r "$APPDATA\net.smisann.mnemovr"
      RMDir /r "$LOCALAPPDATA\net.smisann.mnemovr"
  done:
!macroend

; アンインストール時にもデータ削除を提案する
!macro customUnInstall
  MessageBox MB_YESNO "MnemoVR のデータ（データベース・キャッシュ・設定）も削除しますか？$\n$\n削除しない場合、再インストール時にデータが引き継がれます。" IDNO done
    RMDir /r "$APPDATA\net.smisann.mnemovr"
    RMDir /r "$LOCALAPPDATA\net.smisann.mnemovr"
  done:
!macroend
