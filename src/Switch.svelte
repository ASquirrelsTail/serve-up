<script>
  export let set = false;
</script>

<div class="container" class:set on:click="{() => set=!set}">
  <div class="switch"></div>
</div>

<style>
  .container {
    display: inline-block;
    width: 2em;
    height: 1em;
    border-radius: 0.5em;
    padding: 0.1em;
    background-color: #B1B1B1;
    transition-property: background-color;
    vertical-align: middle;
  }

  .container.set {
    background-color: #00A0AF
  }

  .switch {
    position: relative;
    background-color: #606060;
    width: 1em;
    height: 1em;
    border-radius: 0.5em;
    transition-property: all;
  }

  .set .switch {
    left: 1em;
    background-color: #00606A;
  }
</style>