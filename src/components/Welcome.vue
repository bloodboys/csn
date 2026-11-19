<template>
    <div class="welcome">
        <!-- 欢迎横幅 -->
        <div class="welcome_banner">
            <div class="banner_text">
                <h2 class="banner_title">欢迎使用吃啥呢外卖平台管理系统</h2>
                <p class="banner_sub">高效管理菜品、订单、用户与数据报表的一站式后台</p>
            </div>
            <div class="banner_meta">
                <span class="meta_user">{{ username }}</span>
                <span class="meta_date">{{ today }}</span>
            </div>
        </div>
        <!-- 功能入口 -->
        <div class="feature_grid">
            <div class="feature_card" v-for="item in features" :key="item.path" @click="go(item.path)">
                <i :class="item.icon" :style="{ color: item.color }"></i>
                <div class="feature_info">
                    <p class="feature_name">{{ item.name }}</p>
                    <p class="feature_desc">{{ item.desc }}</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
  data () {
    return {
      features: [
        { name: '用户管理', desc: '用户与角色权限管理', icon: 'el-icon-user-solid', path: '/userlist', color: '#3b82f6' },
        { name: '菜品管理', desc: '分类、参数与菜品维护', icon: 'el-icon-s-shop', path: '/foodclass', color: '#f59e0b' },
        { name: '订单管理', desc: '查看订单与物流进度', icon: 'el-icon-s-order', path: '/orderlist', color: '#10b981' },
        { name: '数据报表', desc: '用户来源统计分析', icon: 'el-icon-s-marketing', path: '/datareport', color: '#8b5cf6' }
      ]
    }
  },
  computed: {
    username () {
      return this.$store.state.login.user.username || '管理员'
    },
    today () {
      const d = new Date()
      const y = d.getFullYear()
      const m = (d.getMonth() + 1 + '').padStart(2, '0')
      const day = (d.getDate() + '').padStart(2, '0')
      const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
      return `${y}年${m}月${day}日 星期${week}`
    }
  },
  methods: {
    go (path) {
      this.$router.push(path)
    }
  }
}
</script>

<style lang="less" scoped>
    .welcome {
        padding: 4px;
    }

    .welcome_banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 36px 40px;
        border-radius: 14px;
        background: linear-gradient(135deg, #3b82f6, #2563eb 60%, #1d4ed8);
        color: #fff;
        box-shadow: 0 8px 24px rgba(37, 99, 235, 0.25);
    }

    .banner_title {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
    }

    .banner_sub {
        margin: 10px 0 0;
        font-size: 14px;
        opacity: 0.9;
    }

    .banner_meta {
        text-align: right;

        .meta_user {
            display: block;
            font-size: 16px;
            font-weight: 600;
        }

        .meta_date {
            display: block;
            margin-top: 6px;
            font-size: 13px;
            opacity: 0.9;
        }
    }

    .feature_grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        margin-top: 20px;
    }

    .feature_card {
        display: flex;
        align-items: center;
        padding: 24px 22px;
        background: #fff;
        border-radius: 12px;
        cursor: pointer;
        transition: transform 0.25s ease, box-shadow 0.25s ease;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);

        &:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }

        i {
            font-size: 40px;
            margin-right: 18px;
        }

        .feature_name {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: #303133;
        }

        .feature_desc {
            margin: 6px 0 0;
            font-size: 13px;
            color: #909399;
        }
    }
</style>
