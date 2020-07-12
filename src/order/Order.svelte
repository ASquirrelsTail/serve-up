<script>
  import { fade, fly } from 'svelte/transition';
  import OrderItem from './OrderItem.svelte';
  import Review from '../Review.svelte';
  import { post } from '../fetch.js';
  import { orderList } from '../store.js';
  export let orderElHeight = 0;

  let total = 0;
  let items = 0;
  let review = false;
  let ordering = false;
  let recieved = false;

  $: {
    total = $orderList.reduce((acc, cur) => acc + parseFloat(cur.price) * cur.count, 0);
    items = $orderList.reduce((acc, cur) => acc + cur.count, 0);
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
          recieved = true;
        }else console.log(response);
        ordering = false;
      });
  }
  
</script>

<div class="order" bind:offsetHeight={orderElHeight} style="position: fixed;">
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
  </div>
</div>

<Review bind:review={review}>
  <div>
    <div class="details center">
      <h3>{items} Items - £{total.toFixed(2)}</h3>
    </div>
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
</Review>

{#if recieved}
<div class="cover" transition:fade on:click="{() => recieved = false}"></div>
<div class="modal" transition:fly>
  <h2>Order recieved</h2>
  <p>We'll get that over to you as soon as we can.</p>
  <div class="center">
    <button class="primary md" on:click="{() => recieved = false}">OK!</button>
  </div>
</div>
{/if}

<style>
  .order {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    max-height: 20vh;
    overflow-y: auto;
    background-color: white;
    border-top: 1px solid grey;
    padding-bottom: 0.4em;
    text-align: center;
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