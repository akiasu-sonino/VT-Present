-- VT-Present Sample Data
-- サンプル配信者データを投入します

INSERT INTO streamers (name, platform, avatar_url, description, tags, follower_count) VALUES
  ('星空あかり', 'YouTube', 'https://i.pravatar.cc/150?img=1', 'ゲーム配信とおしゃべりが好きな新人Vtuberです！', ARRAY['ゲーム', '雑談', 'FPS'], 250),
  ('月夜そら', 'Twitch', 'https://i.pravatar.cc/150?img=2', '歌枠メインで活動しています。癒し系を目指してます♪', ARRAY['歌枠', 'ASMR', '癒し'], 180),
  ('桜井みお', 'YouTube', 'https://i.pravatar.cc/150?img=3', 'ホラゲー実況が得意です！一緒に怖がりましょう！', ARRAY['ホラー', 'ゲーム', '絶叫'], 420),
  ('海月りん', 'YouTube', 'https://i.pravatar.cc/150?img=4', 'お絵描き配信多めです。リクエストもお待ちしてます', ARRAY['お絵描き', '創作', 'イラスト'], 310),
  ('火村ひなた', 'Twitch', 'https://i.pravatar.cc/150?img=5', 'APEXランク配信中！一緒にプレデターを目指そう！', ARRAY['APEX', 'FPS', 'ランク'], 890),
  ('白雪ユキ', 'YouTube', 'https://i.pravatar.cc/150?img=6', 'まったり雑談配信がメインです。お話聞かせてね', ARRAY['雑談', 'マシュマロ', 'まったり'], 150),
  ('緑川なな', 'YouTube', 'https://i.pravatar.cc/150?img=7', 'レトロゲーム実況してます！懐かしいゲームやりましょ', ARRAY['レトロゲーム', 'ゲーム', 'RPG'], 340),
  ('紫電カナ', 'Twitch', 'https://i.pravatar.cc/150?img=8', 'Valorantメインの競技系配信者です', ARRAY['Valorant', 'FPS', '競技'], 620),
  ('黄金まい', 'YouTube', 'https://i.pravatar.cc/150?img=9', 'ASMRと囁き声配信で癒しをお届け', ARRAY['ASMR', '囁き', '癒し'], 540),
  ('虹色いろは', 'YouTube', 'https://i.pravatar.cc/150?img=10', 'Minecraftで建築配信！クリエイティブ大好き', ARRAY['Minecraft', '建築', 'ゲーム'], 280),
  ('空色そよか', 'Twitch', 'https://i.pravatar.cc/150?img=11', 'リズムゲーム配信中！音ゲー好き集まれ～', ARRAY['音ゲー', 'リズムゲーム', 'ゲーム'], 210),
  ('赤城もえ', 'YouTube', 'https://i.pravatar.cc/150?img=12', 'ボカロ歌ってみた配信！リクエスト待ってます', ARRAY['歌枠', 'ボカロ', '歌ってみた'], 380),
  ('銀河こはく', 'YouTube', 'https://i.pravatar.cc/150?img=13', '深夜の作業配信多めです。一緒に作業しましょう', ARRAY['作業配信', '雑談', '深夜'], 190),
  ('蒼井れい', 'Twitch', 'https://i.pravatar.cc/150?img=14', 'LoL配信してます！ランク一緒に回しましょう', ARRAY['LoL', 'MOBA', 'ゲーム'], 450),
  ('橙乃みかん', 'YouTube', 'https://i.pravatar.cc/150?img=15', '料理配信始めました！Vで料理するの楽しい～', ARRAY['料理', '雑談', 'ライフスタイル'], 220),
  ('桃花ももか', 'YouTube', 'https://i.pravatar.cc/150?img=16', 'ポケモン対戦配信！育成論も解説します', ARRAY['ポケモン', '対戦', 'ゲーム'], 510),
  ('茶々まる', 'Twitch', 'https://i.pravatar.cc/150?img=17', 'スプラ3ガチマッチ配信！S+目指します', ARRAY['スプラトゥーン', 'ゲーム', 'TPS'], 670),
  ('灰原くろ', 'YouTube', 'https://i.pravatar.cc/150?img=18', 'ホラーゲーム考察配信。裏設定とか深堀りします', ARRAY['ホラー', '考察', 'ゲーム'], 390),
  ('琥珀あんず', 'YouTube', 'https://i.pravatar.cc/150?img=19', 'インディーズゲーム発掘配信！面白いゲーム探そう', ARRAY['インディーズ', 'ゲーム', '発掘'], 260),
  ('翠星エメ', 'Twitch', 'https://i.pravatar.cc/150?img=20', 'DBDサバイバー配信！逃げ切りたい！', ARRAY['DBD', 'ホラー', 'ゲーム'], 480);
