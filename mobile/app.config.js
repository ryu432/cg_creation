// Web 版を書き出すときだけ（PLANO_WEB=1）、Web 用の設定を足す。
// 普段の設定（app.json）を変えないので、Android アプリの版（runtimeVersion）は変わらず、更新もそのまま届く
module.exports = ({ config }) => {
  if (process.env.PLANO_WEB !== '1') return config;
  return {
    ...config,
    platforms: [...(config.platforms ?? []), 'web'],
    web: { ...config.web, output: 'single' },
  };
};
