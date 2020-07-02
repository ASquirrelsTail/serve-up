<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import OrderItem from './OrderItem.svelte';
  import { post } from '../fetch.js';
  import { orderList } from '../store.js';
  export let orderElHeight = 0;

  let orderEl;

  let total = 0;
  let items = 0;
  let review = false;
  let ordering = false;

  onMount(() => orderElHeight = orderEl.offsetHeight);

  $: {
    total = $orderList.reduce((acc, cur) => acc + parseFloat(cur.price) * cur.count, 0);
    items = $orderList.reduce((acc, cur) => acc + cur.count, 0);
  }

  $: {
    if (review) document.body.style = 'overflow: hidden;';
    else document.body.style = '';
  }

  function placeOrder() {
    ordering = true;
    let order = $orderList.map(item => {return {item: item.id, count: item.count}});
    console.log({order});
    post('order/', {order})
      .then(response => {
        if (response.status === 204) {
          orderList.set([]);
          review = false;
        }else console.log(response);
        ordering = false;
      });
  }
  
</script>
{#if review}
  <div class="cover" transition:fade on:click="{() => review = false}"></div>
{/if}
<div class="order" class:review bind:this={orderEl}>
  <div class="inner">
    <nav>
      <div class="details">
        <h3>{items} Items - £{total.toFixed(2)}</h3>
      </div>
      {#if !review}
      <button class="primary md" on:click="{() => review = true}">
        Review and place order
      </button>
      {/if}
    </nav>
    {#if review}
    <div>
      {#each $orderList as item (item.id)}
      <OrderItem {...item} />
      {:else}
      <p>Add something to your order to continue.</p>
      {/each}
      <div class="buttons">
        <button class="primary md" on:click="{() => review = true}" disabled="{!$orderList.length || ordering}" on:click={placeOrder}>
          Place Order
        </button>
        <button class="secondary md" on:click="{() => review = false}">
          Back to Menu
        </button>
      </div>
    </div>
    {/if}
  </div>
</div>


<style>
  .order {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    max-height: 20vh;
    transition: max-height 0.5s ease-out;
    overflow-y: auto;
    background-color: white;
    border-top: 1px solid grey;
    padding-bottom: 0.4em;
    text-align: center;
  }

  .review {
    max-height: 70vh;
    height: 70vh;
  }

  .inner {
    max-width: 600px;
    margin: auto;
  }

  .buttons {
    margin-top: 0.3em;
    display: flex;
    justify-content: center;
  }

  .buttons button {
    min-width: 30%
  }

  .buttons button:first-child {
    margin-right: 1em;
  }
</style>