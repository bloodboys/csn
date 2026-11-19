export default {
  namespaced: true,
  state: {
    user: {
      username: '',
      token: '',
      rid: null,
      rights: []
    }
  },
  mutations: {
    setUser (state, user) {
      state.user = user
    }
  },
  getters: {
    isAdmin: (state) => state.user.rid === 1,
    rights: (state) => state.user.rights || []
  }
}
