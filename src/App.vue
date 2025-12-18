<script setup lang="ts">
// 测试Vue API自动导入
// 注意：这里不需要显式导入ref，因为unplugin-auto-import会自动导入Vue的API
const message = ref('Vue API 自动导入测试')
const count = ref(0)

// 增加计数函数
const incrementCount = () => {
  count.value++
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
    <!-- 标题部分，使用UnoCSS样式 -->
    <h1 class="text-4xl font-bold text-center mb-8 text-blue-600">
      {{ message }}
    </h1>

    <!-- 测试自动导入的ref和方法 -->
    <div class="space-y-6 w-full max-w-md">
      <el-button type="primary" class="w-full" @click="incrementCount">
        点击计数: {{ count }}
      </el-button>

      <!-- 测试响应式数据 -->
      <div class="text-center p-4 bg-white rounded-lg shadow">
        <p class="text-gray-700">当前计数: {{ count }}</p>
      </div>
    </div>
  </div>
</template>
