<script setup lang="ts">
import { ref } from 'vue'

// 测试响应式数据
const count = ref(0)
const dialogVisible = ref(false)
const inputValue = ref('')

// 增加计数函数
const incrementCount = () => {
  count.value++
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
    <!-- 标题部分，使用UnoCSS样式 -->
    <h1 class="text-4xl font-bold text-center mb-8 text-blue-600">
      Vue3 + Element Plus + UnoCSS 示例
    </h1>

    <!-- 测试Element Plus按钮和SVG图标 -->
    <div class="space-y-6 w-full max-w-md">
      <!-- 测试Element Plus按钮 -->
      <el-button type="primary" class="w-full" @click="incrementCount" icon="el-icon-Plus">
        点击计数: {{ count }}
      </el-button>

      <!-- 测试SVG图标 (通过UnoCSS) -->
      <div class="flex justify-center space-x-6">
        <!-- 使用iconify图标 -->
        <div class="flex flex-col items-center">
          <div class="i-mdi:home text-4xl text-blue-500"></div>
          <span class="mt-2 text-sm">Home 图标</span>
        </div>
        <div class="flex flex-col items-center">
          <div class="i-mdi:settings text-4xl text-green-500"></div>
          <span class="mt-2 text-sm">Settings 图标</span>
        </div>
        <div class="flex flex-col items-center">
          <div class="i-mdi:user text-4xl text-purple-500"></div>
          <span class="mt-2 text-sm">User 图标</span>
        </div>
      </div>

      <!-- 测试Element Plus对话框 -->
      <el-button type="success" @click="dialogVisible = true" class="w-full">
        打开对话框
      </el-button>

      <!-- 测试Element Plus表单元素 -->
      <el-input v-model="inputValue" placeholder="请输入内容" class="w-full" />
    </div>

    <!-- Element Plus对话框组件 -->
    <el-dialog v-model="dialogVisible" title="测试对话框" width="30%">
      <div class="p-4">
        <p class="mb-4">这是一个Element Plus对话框示例</p>
        <p>当前计数: {{ count }}</p>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="dialogVisible = false">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
