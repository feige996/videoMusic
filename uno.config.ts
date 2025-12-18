// UnoCSS配置文件
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  // 配置预设使用顺序
  presets: [
    // 属性化模式预设，启用属性风格的类名
    presetAttributify({
      // 启用前缀模式，避免与原生属性冲突
      prefixedOnly: true,
      // 配置前缀
      prefixes: ['uno-', 'u-'],
    }),
    // 图标预设，提供图标支持
    presetIcons({
      scale: 1.2,
      autoInstall: true,
      prefix: 'i-',
      extraProperties: {
        display: 'inline-block',
        'vertical-align': 'middle',
        width: '1.2em',
        height: '1.2em',
      },
      // 配置默认图标集合
      collections: {
        // 可以在这里添加自定义图标集合
      },
    }),
    // 排版预设，提供更好的文本排版支持
    presetTypography(),
  ],
  // 自定义规则
  rules: [
    // 自定义渐变背景
    [/^gradient-(\w+)-(\w+)$/, ([, from, to]) => `bg-gradient-to-r from-${from} to-${to}`],
  ],
  // 配置转换器
  transformers: [
    // 启用 @apply 指令
    transformerDirectives(),
    // 启用变体组语法，如 (hover:bg-blue-500 hover:text-white)
    transformerVariantGroup(),
  ],
  // 自定义快捷方式
  shortcuts: [
    // 布局相关快捷方式
    ['flex-center', 'flex items-center justify-center'],
    ['flex-between', 'flex items-center justify-between'],
    ['flex-column', 'flex flex-col'],
    ['flex-1', 'flex-1 overflow-hidden'],

    // 容器相关快捷方式
    ['container', 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'],
    ['card', 'bg-white rounded-lg shadow-sm p-4 transition-all duration-300 hover:shadow-md'],
    [
      'card-hover',
      'bg-white rounded-lg shadow-sm p-4 transition-all duration-300 hover:shadow-md hover:translate-y-[-2px]',
    ],

    // 文本相关快捷方式
    ['text-primary', 'text-blue-600'],
    ['text-secondary', 'text-gray-600'],
    ['text-success', 'text-green-600'],
    ['text-warning', 'text-yellow-600'],
    ['text-danger', 'text-red-600'],
    ['text-muted', 'text-gray-500'],

    // 按钮相关快捷方式
    ['btn', 'px-4 py-2 rounded transition-colors duration-300'],
    ['btn-primary', 'btn bg-blue-600 text-white hover:bg-blue-700'],
    ['btn-success', 'btn bg-green-600 text-white hover:bg-green-700'],
    ['btn-warning', 'btn bg-yellow-600 text-white hover:bg-yellow-700'],
    ['btn-danger', 'btn bg-red-600 text-white hover:bg-red-700'],
    ['btn-outline', 'btn border border-gray-300 text-gray-700 hover:bg-gray-100'],

    // 间距相关快捷方式
    ['m-auto', 'mx-auto my-auto'],

    // 边框相关快捷方式
    ['border-all', 'border border-gray-200'],
    ['border-radius', 'rounded-lg'],

    // 阴影相关快捷方式
    ['shadow-light', 'shadow-sm'],
    ['shadow-medium', 'shadow-md'],
    ['shadow-heavy', 'shadow-lg'],

    // 过渡效果快捷方式
    ['transition-all-fast', 'transition-all duration-200'],
    ['transition-all-slow', 'transition-all duration-500'],

    // 溢出相关快捷方式
    ['overflow-auto', 'overflow-auto'],
    ['overflow-hidden', 'overflow-hidden'],
    ['text-ellipsis', 'overflow-hidden text-ellipsis whitespace-nowrap'],

    // z-index相关快捷方式
    ['z-10', 'z-10'],
    ['z-20', 'z-20'],
    ['z-30', 'z-30'],
    ['z-50', 'z-50'],
  ],
  // 自定义主题
  theme: {
    // 扩展或覆盖默认主题
    colors: {
      // 主色调 - 蓝色系列
      primary: {
        DEFAULT: '#1E40AF', // 深蓝作为主色
        50: '#EFF6FF',
        100: '#DBEAFE',
        200: '#BFDBFE',
        300: '#93C5FD',
        400: '#60A5FA',
        500: '#3B82F6',
        600: '#2563EB',
        700: '#1D4ED8',
        800: '#1E40AF',
        900: '#1E3A8A',
      },

      // 辅助色 - 绿色系列
      success: {
        DEFAULT: '#10B981', // 绿色作为成功色
        50: '#ECFDF5',
        100: '#D1FAE5',
        200: '#A7F3D0',
        300: '#6EE7B7',
        400: '#34D399',
        500: '#10B981',
        600: '#059669',
        700: '#047857',
        800: '#065F46',
        900: '#064E3B',
      },

      // 警告色 - 黄色系列
      warning: {
        DEFAULT: '#F59E0B', // 黄色作为警告色
        50: '#FFFBEB',
        100: '#FEF3C7',
        200: '#FDE68A',
        300: '#FCD34D',
        400: '#FBBF24',
        500: '#F59E0B',
        600: '#D97706',
        700: '#B45309',
        800: '#92400E',
        900: '#78350F',
      },

      // 危险色 - 红色系列
      danger: {
        DEFAULT: '#EF4444', // 红色作为危险色
        50: '#FEF2F2',
        100: '#FEE2E2',
        200: '#FECACA',
        300: '#FCA5A5',
        400: '#F87171',
        500: '#EF4444',
        600: '#DC2626',
        700: '#B91C1C',
        800: '#991B1B',
        900: '#7F1D1D',
      },

      // 中性色 - 灰色系列
      neutral: {
        DEFAULT: '#6B7280', // 中性灰色
        50: '#F9FAFB',
        100: '#F3F4F6',
        200: '#E5E7EB',
        300: '#D1D5DB',
        400: '#9CA3AF',
        500: '#6B7280',
        600: '#4B5563',
        700: '#374151',
        800: '#1F2937',
        900: '#111827',
      },

      // 信息色 - 青色系列
      info: {
        DEFAULT: '#06B6D4', // 青色作为信息色
        50: '#ECFEFF',
        100: '#CFFAFE',
        200: '#A5F3FC',
        300: '#67E8F9',
        400: '#22D3EE',
        500: '#06B6D4',
        600: '#0891B2',
        700: '#0E7490',
        800: '#155E75',
        900: '#164E63',
      },

      // 背景色
      background: {
        DEFAULT: '#FFFFFF', // 白色背景
        paper: '#F9FAFB', // 纸张背景色
        surface: '#F3F4F6', // 表面背景色
      },

      // 文本色
      text: {
        DEFAULT: '#1F2937', // 默认文本色
        primary: '#111827', // 主要文本色
        secondary: '#6B7280', // 次要文本色
        disabled: '#9CA3AF', // 禁用文本色
        inverse: '#FFFFFF', // 反色文本
      },
    },

    // 字体配置
    fontFamily: {
      // 主字体
      sans: [
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'Helvetica Neue',
        'Arial',
        'Noto Sans',
        'sans-serif',
        'Apple Color Emoji',
        'Segoe UI Emoji',
        'Segoe UI Symbol',
        'Noto Color Emoji',
      ],

      // 等宽字体
      mono: ['Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],

      // 标题字体
      heading: [
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'Helvetica Neue',
        'Arial',
        'Noto Sans',
        'sans-serif',
      ],
    },

    // 字体大小
    fontSize: {
      xs: '0.75rem', // 12px
      sm: '0.875rem', // 14px
      base: '1rem', // 16px
      lg: '1.125rem', // 18px
      xl: '1.25rem', // 20px
      '2xl': '1.5rem', // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem', // 48px
      '6xl': '3.75rem', // 60px
      '7xl': '4.5rem', // 72px
    },

    // 间距
    spacing: {
      px: '1px',
      0: '0',
      0.5: '0.125rem',
      1: '0.25rem',
      1.5: '0.375rem',
      2: '0.5rem',
      2.5: '0.625rem',
      3: '0.75rem',
      3.5: '0.875rem',
      4: '1rem',
      5: '1.25rem',
      6: '1.5rem',
      7: '1.75rem',
      8: '2rem',
      9: '2.25rem',
      10: '2.5rem',
      11: '2.75rem',
      12: '3rem',
      14: '3.5rem',
      16: '4rem',
      20: '5rem',
      24: '6rem',
      28: '7rem',
      32: '8rem',
      36: '9rem',
      40: '10rem',
      44: '11rem',
      48: '12rem',
      52: '13rem',
      56: '14rem',
      60: '15rem',
      64: '16rem',
      72: '18rem',
      80: '20rem',
      96: '24rem',
    },

    // 圆角
    borderRadius: {
      none: '0',
      sm: '0.125rem',
      DEFAULT: '0.25rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      '2xl': '1rem',
      '3xl': '1.5rem',
      full: '9999px',
    },
  },
  // 安全列表，确保这些类名会被生成
  safelist: [
    // 布局类
    'flex',
    'flex-col',
    'flex-row',
    'flex-wrap',
    'flex-center',
    'flex-between',
    'grid',
    'grid-cols-1',
    'grid-cols-2',
    'grid-cols-3',
    'grid-cols-4',
    'grid-cols-5',
    'grid-cols-6',
    'hidden',
    'block',
    'inline',
    'inline-block',
    'relative',
    'absolute',
    'fixed',
    'sticky',

    // 间距类
    'p-0',
    'p-1',
    'p-2',
    'p-3',
    'p-4',
    'p-5',
    'p-6',
    'p-8',
    'p-10',
    'm-0',
    'm-1',
    'm-2',
    'm-3',
    'm-4',
    'm-5',
    'm-6',
    'm-8',
    'm-10',
    'mx-auto',
    'my-auto',
    'px-2',
    'px-4',
    'px-6',
    'py-2',
    'py-4',
    'py-6',

    // 颜色类
    'bg-primary',
    'bg-success',
    'bg-warning',
    'bg-danger',
    'bg-info',
    'bg-neutral',
    'bg-white',
    'bg-gray-50',
    'bg-gray-100',
    'bg-gray-200',
    'text-primary',
    'text-success',
    'text-warning',
    'text-danger',
    'text-info',
    'text-neutral',
    'text-white',
    'text-gray-500',
    'text-gray-700',
    'text-gray-900',
    'border-primary',
    'border-success',
    'border-warning',
    'border-danger',
    'border-info',
    'border-neutral',
    'border-gray-200',
    'border-gray-300',
    'border-gray-400',

    // 文本类
    'text-xs',
    'text-sm',
    'text-base',
    'text-lg',
    'text-xl',
    'text-2xl',
    'text-3xl',
    'text-4xl',
    'font-normal',
    'font-medium',
    'font-semibold',
    'font-bold',
    'text-left',
    'text-center',
    'text-right',
    'text-justify',
    'text-ellipsis',
    'whitespace-nowrap',

    // 边框类
    'border',
    'border-0',
    'border-t',
    'border-b',
    'border-l',
    'border-r',
    'rounded',
    'rounded-sm',
    'rounded-md',
    'rounded-lg',
    'rounded-xl',
    'rounded-full',

    // 阴影类
    'shadow-sm',
    'shadow-md',
    'shadow-lg',
    'shadow-xl',
    'shadow-2xl',
    'shadow-inner',
    'shadow-none',

    // 交互类
    'hover:bg-primary/90',
    'hover:bg-success/90',
    'hover:bg-warning/90',
    'hover:bg-danger/90',
    'hover:text-primary',
    'hover:text-success',
    'hover:text-warning',
    'hover:text-danger',
    'hover:shadow-md',
    'hover:shadow-lg',
    'active:scale-95',

    // 动画类
    'transition-all',
    'transition-colors',
    'transition-transform',
    'transition-opacity',
    'duration-200',
    'duration-300',
    'duration-500',
    'ease-in',
    'ease-out',
    'ease-in-out',

    // 溢出类
    'overflow-hidden',
    'overflow-auto',
    'overflow-x-auto',
    'overflow-y-auto',

    // 快捷方式类
    'btn',
    'btn-primary',
    'btn-success',
    'btn-warning',
    'btn-danger',
    'btn-outline',
    'card',
    'card-hover',
    'container',

    // 尺寸类
    'w-full',
    'h-full',
    'min-h-screen',
    'w-1/2',
    'w-1/3',
    'w-1/4',
    'w-1/5',
    'w-1/6',
    'h-6',
    'h-8',
    'h-10',
    'h-12',
    'h-16',
    'h-20',
    'w-6',
    'w-8',
    'w-10',
    'w-12',
    'w-16',
    'w-20',

    // 图标类前缀（确保动态图标能正常工作）
    'i-',
    'i-loading',
    'i-success',
    'i-error',
    'i-warning',
    'i-info',

    // 状态类
    'opacity-0',
    'opacity-50',
    'opacity-75',
    'opacity-100',
    'scale-100',
    'scale-105',
    'scale-110',
    'scale-95',
    'scale-90',

    // 自定义规则相关类
    'hover-shadow',
  ],
  // 块列表，确保这些类名不会被生成
  blocklist: [
    // 避免生成不需要的类名
    // 例如：'text-red-500' // 如果不想使用这个颜色
  ],
  // 配置字体回退
  preflights: [],
})
