<script>
  import { fade, slide } from 'svelte/transition';
  export let review = false;
</script>

{#if review}
  <div class="cover" transition:fade on:click="{() => review = false}"></div>

<div class="review" transition:slide>
  <div class="inner">
    <slot></slot>
  </div>
</div>
{/if}

<style>
  .review {
    height: 70vh;
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    transition: height;
    overflow-y: auto;
    background-color: white;
    border-top: 1px solid grey;
    padding-bottom: 0.4em;
  }

  .back button {
    margin: auto;
  }

  .inner {
    height:100%;
    max-width: 600px;
    margin: auto;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
</style>