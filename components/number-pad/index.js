Component({
  properties: {
    disabled: {
      type: Boolean,
      value: false,
    },
    confirmText: {
      type: String,
      value: "确认",
    },
  },

  methods: {
    emitInput(e) {
      if (this.data.disabled) {
        return;
      }
      this.triggerEvent("input", { value: e.currentTarget.dataset.value });
    },

    emitDelete() {
      if (this.data.disabled) {
        return;
      }
      this.triggerEvent("delete");
    },

    emitClear() {
      if (this.data.disabled) {
        return;
      }
      this.triggerEvent("clear");
    },

    emitSubmit() {
      if (this.data.disabled) {
        return;
      }
      this.triggerEvent("submit");
    },
  },
});
