module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Syntax and potential errors
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    'no-undef': 'error',
    'no-extra-parens': ['error', 'functions'],
    
    // React specific rules
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',
    'react/no-deprecated': 'error',
    'react/jsx-key': 'error',
    'react/jsx-no-duplicate-props': 'error',
    
    // React Native specific rules
    'react-native/no-unused-styles': 'error',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-color-literals': 'warn',
    
    // Best practices
    'eqeqeq': ['error', 'always', { 'null': 'ignore' }],
    'curly': ['error', 'all'],
    'no-eval': 'error',
    'no-return-await': 'error',
    'require-await': 'error',
    
    // ES6
    'arrow-body-style': ['error', 'as-needed'],
    'arrow-parens': ['error', 'always'],
    'arrow-spacing': 'error',
    'no-duplicate-imports': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-template': 'error',
  },
  env: {
    'react-native/react-native': true,
    'jest': true,
    'es6': true,
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2020,
    sourceType: 'module',
  },
};
