// Jest only: Vite's import.meta.env becomes process.env, so modules that read
// it (earningsService, paymentService…) can be tested. Vite builds don't use this file.
const importMetaEnvForJest = ({ types: t }) => ({
  visitor: {
    MetaProperty(path) {
      if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
        path.replaceWith(t.objectExpression([
          t.objectProperty(t.identifier('env'), t.memberExpression(t.identifier('process'), t.identifier('env'))),
        ]));
      }
    },
  },
});

export default (api) => ({
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }]
  ],
  plugins: api.env('test') ? [importMetaEnvForJest] : [],
});
