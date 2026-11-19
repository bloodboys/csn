import axios from '../utils/request'
import base from './base'

const api = {
  /**
     * 注册
     */
  register (params) {
    return axios.post(base.baseUrl + base.register, params)
  },
  /**
     * 登陆
     */
  login (params) {
    return axios.post(base.baseUrl + base.login, params)
  },
  /**
     * 权限列表
     */
  rights (params) {
    return axios.get(base.baseUrl + base.rights, {
      params
    })
  },
  /**
     * 权限树列表
     */
  rightstree (params) {
    return axios.get(base.baseUrl + base.rightstree, {
      params
    })
  },
  /**
     * 添加权限
     */
  addright (params) {
    return axios.post(base.baseUrl + base.addright, params)
  },
  /**
     * 编辑权限
     */
  updateright (params) {
    return axios.put(base.baseUrl + base.updateright, params)
  },
  /**
     * 删除权限
     */
  deleteright (params) {
    return axios.delete(base.baseUrl + base.deleteright, { data: params })
  },
  /**
     * 商品总条数
     */
  total () {
    return axios.get(base.baseUrl + base.total)
  },
  /**
     * 用户信息查询
     */
  usersearch (params) {
    return axios.get(base.baseUrl + base.userSearch, {
      params
    })
  },
  /**
     * 类目选择
     */
  selectItemCategoryByParentId (params) {
    return axios.get(base.baseUrl + base.selectItemCategoryByParentId, {
      params
    })
  },
  /**
     * 添加用户
     */
  adduser (params) {
    return axios.post(base.baseUrl + base.adduser, params)
  },
  /**
     * 商品删除
     */
  deleteUserById (params) {
    return axios.delete(base.baseUrl + base.deleteUserById, { data: params })
  },
  /**
     * 用户预更新
     */
  preUpdateUser (params) {
    return axios.get(base.baseUrl + base.preUpdateUser, {
      params
    })
  },
  /**
     * 用户修改
     */
  updateUser (params) {
    return axios.put(base.baseUrl + base.updateUser, params)
  },
  /**
     * 角色列表
     */
  roles (params) {
    return axios.get(base.baseUrl + base.roles, {
      params
    })
  },
  /**
     * 规格参数模糊查询
     */
  paramsSearch (params) {
    return axios.get(base.baseUrl + base.paramsSearch, {
      params
    })
  },
  /**
     * 左侧菜单权限
     */
  menus (params) {
    return axios.get(base.baseUrl + base.menus, {
      params
    })
  },

  /**
     * 用户列表
     */
  users (params) {
    return axios.get(base.baseUrl + base.users, {
      params
    })
  },

  /**
       * 用户状态修改
       */
  updateuserstate (params) {
    return axios.put(base.baseUrl + base.updateuserstate, params)
  },
  /**
     * 角色权限删除
     */
  deleteRightById (params) {
    return axios.put(base.baseUrl + base.deleteRightById, params)
  },
  /**
     * 返回角色权限
     */
  returnRightById (params) {
    return axios.get(base.baseUrl + base.returnRightById, {
      params
    })
  },

  /**
     * 获取所有权限列表
     */
  allRightById (params) {
    return axios.get(base.baseUrl + base.allRightById, {
      params
    })
  },
  /**
     * 用户角色对应id查找
     */
  UserRoleById (params) {
    return axios.get(base.baseUrl + base.UserRoleById, {
      params
    })
  },
  /**
     * 添加角色
     */
  addrole (params) {
    return axios.post(base.baseUrl + base.addrole, params)
  },
  /**
     * 角色预更新
     */
  preUpdateUserRole (params) {
    return axios.get(base.baseUrl + base.preUpdateUserRole, {
      params
    })
  },
  /**
     * 角色修改
     */
  updateUserRole (params) {
    return axios.put(base.baseUrl + base.updateUserRole, params)
  },
  /**
     * 角色删除
     */
  deleteRoleById (params) {
    return axios.delete(base.baseUrl + base.deleteRoleById, { data: params })
  },
  /**
     * 菜品分类数据列表
     */
  foodscate (params) {
    return axios.get(base.baseUrl + base.foodscate, {
      params
    })
  },
  /**
     * 添加菜品分类
     */
  addfoodscate (params) {
    return axios.post(base.baseUrl + base.addfoodscate, params)
  },
  /**
     * 编辑菜品分类预更新
     */
  preUpdateCate (params) {
    return axios.get(base.baseUrl + base.preUpdateCate, {
      params
    })
  },
  /**
     * 菜品分类名修改
     */
  updateCate (params) {
    return axios.put(base.baseUrl + base.updateCate, params)
  },
  /**
     * 菜品分类删除
     */
  deleteCateById (params) {
    return axios.put(base.baseUrl + base.deleteCateById, params)
  },
  /**
     * 检查分类下菜品数
     */
  foodcountbycate (params) {
    return axios.get(base.baseUrl + base.foodcountbycate, {
      params
    })
  },
  /**
     * 分类参数列表
     */
  cateparams (params) {
    return axios.get(base.baseUrl + base.cateparams, {
      params
    })
  },
  /**
     * 添加分类参数
     */
  addcateparams (params) {
    return axios.post(base.baseUrl + base.addcateparams, params)
  },
  /**
     * 分类参数预更新
     */
  preUpdateParams (params) {
    return axios.get(base.baseUrl + base.preUpdateParams, {
      params
    })
  },
  /**
     * 分类参数修改
     */
  updateParams (params) {
    return axios.put(base.baseUrl + base.updateParams, params)
  },
  /**
     * 分类参数删除
     */
  deleteParamsById (params) {
    return axios.delete(base.baseUrl + base.deleteParamsById, { data: params })
  },
  /**
     * 菜品列表
     */
  foods (params) {
    return axios.get(base.baseUrl + base.foods, {
      params
    })
  },
  /**
     * 菜品信息查询
     */
  foodsearch (params) {
    return axios.get(base.baseUrl + base.foodSearch, {
      params
    })
  },
  /**
     * 菜品删除
     */
  deleteFoodById (params) {
    return axios.delete(base.baseUrl + base.deleteFoodById, { data: params })
  },
  /**
     * 添加菜品
     */
  addfood (params) {
    return axios.post(base.baseUrl + base.addfood, params)
  },
  /**
     * 菜品修改
     */
  updatefood (params) {
    return axios.put(base.baseUrl + base.updatefood, params)
  },
  /**
     * 编辑菜品预更新
     */
  preUpdatefood (params) {
    return axios.get(base.baseUrl + base.preUpdatefood, {
      params
    })
  },
  /**
     * 订单列表
     */
  order (params) {
    return axios.get(base.baseUrl + base.order, {
      params
    })
  },
  /**
     * 订单查询
     */
  ordersearch (params) {
    return axios.get(base.baseUrl + base.ordersearch, {
      params
    })
  },
  /**
     * 修改订单地址
     */
  updateOrderAddress (params) {
    return axios.put(base.baseUrl + base.updateOrderAddress, params)
  },
  /**
     * 数据报表
     */
  report (params) {
    return axios.get(base.baseUrl + base.report, {
      params
    })
  },
  /**
     * 数据统计（动态聚合）
     */
  statistics (params) {
    return axios.get(base.baseUrl + base.statistics, {
      params
    })
  }
}

export default api
