var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function is_promise(value) {
        return value && typeof value === 'object' && typeof value.then === 'function';
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function set_store_value(store, ret, value = ret) {
        store.set(value);
        return ret;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? undefined : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                info.blocks[i] = null;
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error(`Cannot have duplicate keys in a keyed each`);
            }
            keys.add(key);
        }
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.23.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev("SvelteDOMSetProperty", { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/checkin/Visitor.svelte generated by Svelte v3.23.2 */

    const file = "src/checkin/Visitor.svelte";

    function create_fragment(ctx) {
    	let div6;
    	let form;
    	let div1;
    	let label0;
    	let t1;
    	let input0;
    	let t2;
    	let div0;
    	let t3_value = /*errors*/ ctx[3].name + "";
    	let t3;
    	let t4;
    	let div3;
    	let label1;
    	let t6;
    	let input1;
    	let t7;
    	let div2;
    	let t8_value = /*errors*/ ctx[3].phone_number + "";
    	let t8;
    	let t9;
    	let div5;
    	let label2;
    	let t11;
    	let input2;
    	let t12;
    	let div4;
    	let t13_value = /*errors*/ ctx[3].email + "";
    	let t13;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			form = element("form");
    			div1 = element("div");
    			label0 = element("label");
    			label0.textContent = "Name:";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			div0 = element("div");
    			t3 = text(t3_value);
    			t4 = space();
    			div3 = element("div");
    			label1 = element("label");
    			label1.textContent = "Tel:";
    			t6 = space();
    			input1 = element("input");
    			t7 = space();
    			div2 = element("div");
    			t8 = text(t8_value);
    			t9 = space();
    			div5 = element("div");
    			label2 = element("label");
    			label2.textContent = "Email:";
    			t11 = space();
    			input2 = element("input");
    			t12 = space();
    			div4 = element("div");
    			t13 = text(t13_value);
    			attr_dev(label0, "for", "name");
    			attr_dev(label0, "class", "svelte-1ftsr2y");
    			add_location(label0, file, 15, 6, 339);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "name");
    			input0.disabled = /*disabled*/ ctx[4];
    			attr_dev(input0, "class", "svelte-1ftsr2y");
    			add_location(input0, file, 16, 6, 377);
    			attr_dev(div0, "class", "error svelte-1ftsr2y");
    			add_location(div0, file, 17, 6, 463);
    			attr_dev(div1, "class", "input-row svelte-1ftsr2y");
    			toggle_class(div1, "invalid", /*errors*/ ctx[3].name);
    			add_location(div1, file, 14, 4, 281);
    			attr_dev(label1, "for", "phone_number");
    			attr_dev(label1, "class", "svelte-1ftsr2y");
    			add_location(label1, file, 20, 6, 583);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "phone_number");
    			input1.disabled = /*disabled*/ ctx[4];
    			attr_dev(input1, "class", "svelte-1ftsr2y");
    			add_location(input1, file, 21, 6, 628);
    			attr_dev(div2, "class", "error svelte-1ftsr2y");
    			add_location(div2, file, 22, 6, 730);
    			attr_dev(div3, "class", "input-row svelte-1ftsr2y");
    			toggle_class(div3, "invalid", /*errors*/ ctx[3].phone_number);
    			add_location(div3, file, 19, 4, 517);
    			attr_dev(label2, "for", "email");
    			attr_dev(label2, "class", "svelte-1ftsr2y");
    			add_location(label2, file, 25, 6, 852);
    			attr_dev(input2, "type", "email");
    			attr_dev(input2, "id", "email");
    			input2.disabled = /*disabled*/ ctx[4];
    			attr_dev(input2, "class", "svelte-1ftsr2y");
    			add_location(input2, file, 26, 6, 892);
    			attr_dev(div4, "class", "error svelte-1ftsr2y");
    			add_location(div4, file, 27, 6, 981);
    			attr_dev(div5, "class", "input-row svelte-1ftsr2y");
    			toggle_class(div5, "invalid", /*errors*/ ctx[3].email);
    			add_location(div5, file, 24, 4, 792);
    			add_location(form, file, 13, 2, 245);
    			attr_dev(div6, "class", "visitor svelte-1ftsr2y");
    			add_location(div6, file, 12, 0, 221);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, form);
    			append_dev(form, div1);
    			append_dev(div1, label0);
    			append_dev(div1, t1);
    			append_dev(div1, input0);
    			set_input_value(input0, /*name*/ ctx[0]);
    			append_dev(div1, t2);
    			append_dev(div1, div0);
    			append_dev(div0, t3);
    			append_dev(form, t4);
    			append_dev(form, div3);
    			append_dev(div3, label1);
    			append_dev(div3, t6);
    			append_dev(div3, input1);
    			set_input_value(input1, /*phone_number*/ ctx[1]);
    			append_dev(div3, t7);
    			append_dev(div3, div2);
    			append_dev(div2, t8);
    			append_dev(form, t9);
    			append_dev(form, div5);
    			append_dev(div5, label2);
    			append_dev(div5, t11);
    			append_dev(div5, input2);
    			set_input_value(input2, /*email*/ ctx[2]);
    			append_dev(div5, t12);
    			append_dev(div5, div4);
    			append_dev(div4, t13);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[7]),
    					listen_dev(input0, "change", /*onChange*/ ctx[5], false, false, false),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[8]),
    					listen_dev(input1, "change", /*onChange*/ ctx[5], false, false, false),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[9]),
    					listen_dev(input2, "change", /*onChange*/ ctx[5], false, false, false),
    					listen_dev(form, "submit", prevent_default(/*submit_handler*/ ctx[6]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*disabled*/ 16) {
    				prop_dev(input0, "disabled", /*disabled*/ ctx[4]);
    			}

    			if (dirty & /*name*/ 1 && input0.value !== /*name*/ ctx[0]) {
    				set_input_value(input0, /*name*/ ctx[0]);
    			}

    			if (dirty & /*errors*/ 8 && t3_value !== (t3_value = /*errors*/ ctx[3].name + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*errors*/ 8) {
    				toggle_class(div1, "invalid", /*errors*/ ctx[3].name);
    			}

    			if (dirty & /*disabled*/ 16) {
    				prop_dev(input1, "disabled", /*disabled*/ ctx[4]);
    			}

    			if (dirty & /*phone_number*/ 2 && input1.value !== /*phone_number*/ ctx[1]) {
    				set_input_value(input1, /*phone_number*/ ctx[1]);
    			}

    			if (dirty & /*errors*/ 8 && t8_value !== (t8_value = /*errors*/ ctx[3].phone_number + "")) set_data_dev(t8, t8_value);

    			if (dirty & /*errors*/ 8) {
    				toggle_class(div3, "invalid", /*errors*/ ctx[3].phone_number);
    			}

    			if (dirty & /*disabled*/ 16) {
    				prop_dev(input2, "disabled", /*disabled*/ ctx[4]);
    			}

    			if (dirty & /*email*/ 4 && input2.value !== /*email*/ ctx[2]) {
    				set_input_value(input2, /*email*/ ctx[2]);
    			}

    			if (dirty & /*errors*/ 8 && t13_value !== (t13_value = /*errors*/ ctx[3].email + "")) set_data_dev(t13, t13_value);

    			if (dirty & /*errors*/ 8) {
    				toggle_class(div5, "invalid", /*errors*/ ctx[3].email);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { name = "" } = $$props;
    	let { phone_number = "" } = $$props;
    	let { email = "" } = $$props;
    	let { errors = {} } = $$props;
    	let { disabled = false } = $$props;

    	function onChange(e) {
    		$$invalidate(3, errors[e.target.id] = false, errors);
    	}

    	const writable_props = ["name", "phone_number", "email", "errors", "disabled"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Visitor> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Visitor", $$slots, []);

    	function submit_handler(event) {
    		bubble($$self, event);
    	}

    	function input0_input_handler() {
    		name = this.value;
    		$$invalidate(0, name);
    	}

    	function input1_input_handler() {
    		phone_number = this.value;
    		$$invalidate(1, phone_number);
    	}

    	function input2_input_handler() {
    		email = this.value;
    		$$invalidate(2, email);
    	}

    	$$self.$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("phone_number" in $$props) $$invalidate(1, phone_number = $$props.phone_number);
    		if ("email" in $$props) $$invalidate(2, email = $$props.email);
    		if ("errors" in $$props) $$invalidate(3, errors = $$props.errors);
    		if ("disabled" in $$props) $$invalidate(4, disabled = $$props.disabled);
    	};

    	$$self.$capture_state = () => ({
    		name,
    		phone_number,
    		email,
    		errors,
    		disabled,
    		onChange
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("phone_number" in $$props) $$invalidate(1, phone_number = $$props.phone_number);
    		if ("email" in $$props) $$invalidate(2, email = $$props.email);
    		if ("errors" in $$props) $$invalidate(3, errors = $$props.errors);
    		if ("disabled" in $$props) $$invalidate(4, disabled = $$props.disabled);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		name,
    		phone_number,
    		email,
    		errors,
    		disabled,
    		onChange,
    		submit_handler,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler
    	];
    }

    class Visitor extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			name: 0,
    			phone_number: 1,
    			email: 2,
    			errors: 3,
    			disabled: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Visitor",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get name() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get phone_number() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set phone_number(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get email() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set email(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get errors() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set errors(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function request(endpoint, method, data) {
      return fetch(endpoint, {
        method: method,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        },
        body: JSON.stringify(data)
      });
    }

    function post(endpoint, data) {
      return request(endpoint, 'POST', data);
    }

    function patch(endpoint, data) {
      return request(endpoint, 'PATCH', data);
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const group = writable(document.body.dataset.group);
    const user = writable(document.body.dataset.user);
    const orderList = writable([]);

    orderList.addOrUpdate = function (item) {
      this.update(order => {
        const updatedItem = order.find(orderItem => orderItem.id === item.id);
        if (updatedItem) updatedItem.count = item.count;else if (item.count > 0) order.push(item);
        return order.filter(item => item.count > 0);
      });
    };

    /* src/checkin/CheckIn.svelte generated by Svelte v3.23.2 */
    const file$1 = "src/checkin/CheckIn.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	child_ctx[13] = list;
    	child_ctx[14] = i;
    	return child_ctx;
    }

    // (40:0) {#each visitors as visitor, i (i)}
    function create_each_block(key_1, ctx) {
    	let first;
    	let visitor;
    	let updating_name;
    	let updating_email;
    	let updating_phone_number;
    	let current;

    	function visitor_name_binding(value) {
    		/*visitor_name_binding*/ ctx[8].call(null, value, /*visitor*/ ctx[12]);
    	}

    	function visitor_email_binding(value) {
    		/*visitor_email_binding*/ ctx[9].call(null, value, /*visitor*/ ctx[12]);
    	}

    	function visitor_phone_number_binding(value) {
    		/*visitor_phone_number_binding*/ ctx[10].call(null, value, /*visitor*/ ctx[12]);
    	}

    	let visitor_props = {
    		errors: /*errors*/ ctx[1][/*i*/ ctx[14]],
    		disabled: /*disabled*/ ctx[4]
    	};

    	if (/*visitor*/ ctx[12].name !== void 0) {
    		visitor_props.name = /*visitor*/ ctx[12].name;
    	}

    	if (/*visitor*/ ctx[12].email !== void 0) {
    		visitor_props.email = /*visitor*/ ctx[12].email;
    	}

    	if (/*visitor*/ ctx[12].phone_number !== void 0) {
    		visitor_props.phone_number = /*visitor*/ ctx[12].phone_number;
    	}

    	visitor = new Visitor({ props: visitor_props, $$inline: true });
    	binding_callbacks.push(() => bind(visitor, "name", visitor_name_binding));
    	binding_callbacks.push(() => bind(visitor, "email", visitor_email_binding));
    	binding_callbacks.push(() => bind(visitor, "phone_number", visitor_phone_number_binding));

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(visitor.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(visitor, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const visitor_changes = {};
    			if (dirty & /*errors, visitors*/ 3) visitor_changes.errors = /*errors*/ ctx[1][/*i*/ ctx[14]];
    			if (dirty & /*disabled*/ 16) visitor_changes.disabled = /*disabled*/ ctx[4];

    			if (!updating_name && dirty & /*visitors*/ 1) {
    				updating_name = true;
    				visitor_changes.name = /*visitor*/ ctx[12].name;
    				add_flush_callback(() => updating_name = false);
    			}

    			if (!updating_email && dirty & /*visitors*/ 1) {
    				updating_email = true;
    				visitor_changes.email = /*visitor*/ ctx[12].email;
    				add_flush_callback(() => updating_email = false);
    			}

    			if (!updating_phone_number && dirty & /*visitors*/ 1) {
    				updating_phone_number = true;
    				visitor_changes.phone_number = /*visitor*/ ctx[12].phone_number;
    				add_flush_callback(() => updating_phone_number = false);
    			}

    			visitor.$set(visitor_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(visitor.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(visitor.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(visitor, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(40:0) {#each visitors as visitor, i (i)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let h1;
    	let t1;
    	let p0;
    	let t3;
    	let p1;
    	let t4;
    	let t5;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t6;
    	let div;
    	let button0;
    	let t7;
    	let t8;
    	let button1;
    	let t9;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*visitors*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*i*/ ctx[14];
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Check In";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Libero earum praesentium tempora fuga ipsam dolor sunt recusandae dicta possimus, animi dolore fugit labore nesciunt veniam vel officia, laboriosam deserunt molestiae!";
    			t3 = space();
    			p1 = element("p");
    			t4 = text(/*error*/ ctx[2]);
    			t5 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t6 = space();
    			div = element("div");
    			button0 = element("button");
    			t7 = text("Add another visitor");
    			t8 = space();
    			button1 = element("button");
    			t9 = text("Check In");
    			add_location(h1, file$1, 36, 0, 894);
    			add_location(p0, file$1, 37, 0, 912);
    			attr_dev(p1, "class", "error svelte-1arn6tv");
    			toggle_class(p1, "visible", /*error*/ ctx[2]);
    			add_location(p1, file$1, 38, 0, 1145);
    			button0.disabled = /*disabled*/ ctx[4];
    			attr_dev(button0, "class", "svelte-1arn6tv");
    			add_location(button0, file$1, 47, 2, 1440);
    			button1.disabled = /*disabled*/ ctx[4];
    			attr_dev(button1, "class", "svelte-1arn6tv");
    			add_location(button1, file$1, 48, 2, 1527);
    			attr_dev(div, "class", "buttons svelte-1arn6tv");
    			add_location(div, file$1, 46, 0, 1416);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p0, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t4);
    			/*p1_binding*/ ctx[7](p1);
    			insert_dev(target, t5, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, t6, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(button0, t7);
    			append_dev(div, t8);
    			append_dev(div, button1);
    			append_dev(button1, t9);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", prevent_default(/*addVisitor*/ ctx[5]), false, true, false),
    					listen_dev(button1, "click", prevent_default(/*checkIn*/ ctx[6]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*error*/ 4) set_data_dev(t4, /*error*/ ctx[2]);

    			if (dirty & /*error*/ 4) {
    				toggle_class(p1, "visible", /*error*/ ctx[2]);
    			}

    			if (dirty & /*errors, visitors, disabled*/ 19) {
    				const each_value = /*visitors*/ ctx[0];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, t6.parentNode, outro_and_destroy_block, create_each_block, t6, get_each_context);
    				check_outros();
    			}

    			if (!current || dirty & /*disabled*/ 16) {
    				prop_dev(button0, "disabled", /*disabled*/ ctx[4]);
    			}

    			if (!current || dirty & /*disabled*/ 16) {
    				prop_dev(button1, "disabled", /*disabled*/ ctx[4]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(p1);
    			/*p1_binding*/ ctx[7](null);
    			if (detaching) detach_dev(t5);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $group;
    	validate_store(group, "group");
    	component_subscribe($$self, group, $$value => $$invalidate(11, $group = $$value));
    	let visitors = [];
    	let errors = [];
    	addVisitor();
    	let error = "";
    	let errorMessage;
    	let disabled = false;

    	function addVisitor() {
    		$$invalidate(0, visitors = [...visitors, { name: "", phone_number: "", email: "" }]);
    		$$invalidate(1, errors = [...errors, {}]);
    	}

    	function checkIn() {
    		$$invalidate(4, disabled = true);

    		$$invalidate(0, visitors = [
    			visitors[0],
    			...visitors.slice(1).filter(visitor => visitor.name || visitor.email || visitor.phone_number)
    		]);

    		post("group/", { visitors }).then(async response => {
    			if (response.status === 204) set_store_value(group, $group = true); else {
    				const data = await response.json();
    				$$invalidate(2, error = data.error);
    				$$invalidate(1, errors = data.form_errors);
    				errorMessage.scrollIntoView();
    				$$invalidate(4, disabled = false);
    			}
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<CheckIn> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("CheckIn", $$slots, []);

    	function p1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			errorMessage = $$value;
    			$$invalidate(3, errorMessage);
    		});
    	}

    	function visitor_name_binding(value, visitor) {
    		visitor.name = value;
    		$$invalidate(0, visitors);
    	}

    	function visitor_email_binding(value, visitor) {
    		visitor.email = value;
    		$$invalidate(0, visitors);
    	}

    	function visitor_phone_number_binding(value, visitor) {
    		visitor.phone_number = value;
    		$$invalidate(0, visitors);
    	}

    	$$self.$capture_state = () => ({
    		Visitor,
    		post,
    		group,
    		visitors,
    		errors,
    		error,
    		errorMessage,
    		disabled,
    		addVisitor,
    		checkIn,
    		$group
    	});

    	$$self.$inject_state = $$props => {
    		if ("visitors" in $$props) $$invalidate(0, visitors = $$props.visitors);
    		if ("errors" in $$props) $$invalidate(1, errors = $$props.errors);
    		if ("error" in $$props) $$invalidate(2, error = $$props.error);
    		if ("errorMessage" in $$props) $$invalidate(3, errorMessage = $$props.errorMessage);
    		if ("disabled" in $$props) $$invalidate(4, disabled = $$props.disabled);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		visitors,
    		errors,
    		error,
    		errorMessage,
    		disabled,
    		addVisitor,
    		checkIn,
    		p1_binding,
    		visitor_name_binding,
    		visitor_email_binding,
    		visitor_phone_number_binding
    	];
    }

    class CheckIn extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CheckIn",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/menu/MenuItem.svelte generated by Svelte v3.23.2 */
    const file$2 = "src/menu/MenuItem.svelte";

    // (37:4) {#if description}
    function create_if_block(ctx) {
    	let p;
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*description*/ ctx[1]);
    			attr_dev(p, "class", "description");
    			add_location(p, file$2, 37, 4, 732);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*description*/ 2) set_data_dev(t, /*description*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(37:4) {#if description}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div4;
    	let div0;
    	let h3;
    	let t0;
    	let t1;
    	let t2;
    	let div3;
    	let div1;
    	let t3;
    	let t4;
    	let t5;
    	let t6;
    	let div2;
    	let button0;
    	let t8;
    	let input;
    	let t9;
    	let button1;
    	let mounted;
    	let dispose;
    	let if_block = /*description*/ ctx[1] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div0 = element("div");
    			h3 = element("h3");
    			t0 = text(/*name*/ ctx[0]);
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();
    			div3 = element("div");
    			div1 = element("div");
    			t3 = text("£");
    			t4 = text(/*price*/ ctx[2]);
    			t5 = text(" ea.");
    			t6 = space();
    			div2 = element("div");
    			button0 = element("button");
    			button0.textContent = "-";
    			t8 = space();
    			input = element("input");
    			t9 = space();
    			button1 = element("button");
    			button1.textContent = "+";
    			attr_dev(h3, "class", "name svelte-1pt4zm0");
    			add_location(h3, file$2, 35, 4, 677);
    			attr_dev(div0, "class", "details");
    			add_location(div0, file$2, 34, 2, 651);
    			attr_dev(div1, "class", "price svelte-1pt4zm0");
    			add_location(div1, file$2, 41, 4, 818);
    			attr_dev(button0, "class", "minus");
    			add_location(button0, file$2, 43, 6, 886);
    			attr_dev(input, "type", "number");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "class", "svelte-1pt4zm0");
    			add_location(input, file$2, 44, 6, 943);
    			attr_dev(button1, "class", "plus");
    			add_location(button1, file$2, 45, 6, 1014);
    			attr_dev(div2, "class", "count svelte-1pt4zm0");
    			add_location(div2, file$2, 42, 4, 860);
    			attr_dev(div3, "class", "order");
    			add_location(div3, file$2, 40, 2, 794);
    			attr_dev(div4, "class", "menu-item svelte-1pt4zm0");
    			add_location(div4, file$2, 33, 0, 625);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div0);
    			append_dev(div0, h3);
    			append_dev(h3, t0);
    			append_dev(div0, t1);
    			if (if_block) if_block.m(div0, null);
    			append_dev(div4, t2);
    			append_dev(div4, div3);
    			append_dev(div3, div1);
    			append_dev(div1, t3);
    			append_dev(div1, t4);
    			append_dev(div1, t5);
    			append_dev(div3, t6);
    			append_dev(div3, div2);
    			append_dev(div2, button0);
    			append_dev(div2, t8);
    			append_dev(div2, input);
    			set_input_value(input, /*count*/ ctx[3]);
    			append_dev(div2, t9);
    			append_dev(div2, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*remove*/ ctx[6], false, false, false),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[11]),
    					listen_dev(input, "input", /*update*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*add*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data_dev(t0, /*name*/ ctx[0]);

    			if (/*description*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*price*/ 4) set_data_dev(t4, /*price*/ ctx[2]);

    			if (dirty & /*count*/ 8 && to_number(input.value) !== /*count*/ ctx[3]) {
    				set_input_value(input, /*count*/ ctx[3]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $orderList;
    	validate_store(orderList, "orderList");
    	component_subscribe($$self, orderList, $$value => $$invalidate(12, $orderList = $$value));
    	let { name = "Menu Item" } = $$props;
    	let { description = false } = $$props;
    	let { price = "0.00" } = $$props;
    	let { vat = true } = $$props;
    	let { id } = $$props;
    	let { order = 1 } = $$props;
    	let { visible = true } = $$props;
    	let count = 0;

    	function update() {
    		orderList.addOrUpdate({ id, name, price, vat, count });
    	}

    	function add() {
    		$$invalidate(3, count++, count);
    		update();
    	}

    	function remove() {
    		$$invalidate(3, count = Math.max(count - 1, 0));
    		update();
    	}

    	const writable_props = ["name", "description", "price", "vat", "id", "order", "visible"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MenuItem> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("MenuItem", $$slots, []);

    	function input_input_handler() {
    		count = to_number(this.value);
    		(($$invalidate(3, count), $$invalidate(12, $orderList)), $$invalidate(8, id));
    	}

    	$$self.$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("description" in $$props) $$invalidate(1, description = $$props.description);
    		if ("price" in $$props) $$invalidate(2, price = $$props.price);
    		if ("vat" in $$props) $$invalidate(7, vat = $$props.vat);
    		if ("id" in $$props) $$invalidate(8, id = $$props.id);
    		if ("order" in $$props) $$invalidate(9, order = $$props.order);
    		if ("visible" in $$props) $$invalidate(10, visible = $$props.visible);
    	};

    	$$self.$capture_state = () => ({
    		orderList,
    		name,
    		description,
    		price,
    		vat,
    		id,
    		order,
    		visible,
    		count,
    		update,
    		add,
    		remove,
    		$orderList
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("description" in $$props) $$invalidate(1, description = $$props.description);
    		if ("price" in $$props) $$invalidate(2, price = $$props.price);
    		if ("vat" in $$props) $$invalidate(7, vat = $$props.vat);
    		if ("id" in $$props) $$invalidate(8, id = $$props.id);
    		if ("order" in $$props) $$invalidate(9, order = $$props.order);
    		if ("visible" in $$props) $$invalidate(10, visible = $$props.visible);
    		if ("count" in $$props) $$invalidate(3, count = $$props.count);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$orderList, id*/ 4352) {
    			 {
    				const orderItem = $orderList.find(item => item.id === id);
    				if (orderItem) $$invalidate(3, count = orderItem.count); else $$invalidate(3, count = 0);
    			}
    		}
    	};

    	return [
    		name,
    		description,
    		price,
    		count,
    		update,
    		add,
    		remove,
    		vat,
    		id,
    		order,
    		visible,
    		input_input_handler
    	];
    }

    class MenuItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			name: 0,
    			description: 1,
    			price: 2,
    			vat: 7,
    			id: 8,
    			order: 9,
    			visible: 10
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MenuItem",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*id*/ ctx[8] === undefined && !("id" in props)) {
    			console.warn("<MenuItem> was created without expected prop 'id'");
    		}
    	}

    	get name() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get description() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set description(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get price() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set price(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get vat() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set vat(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get order() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set order(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get visible() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set visible(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/menu/MenuSection.svelte generated by Svelte v3.23.2 */
    const file$3 = "src/menu/MenuSection.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (14:4) {#if description}
    function create_if_block$1(ctx) {
    	let p;
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*description*/ ctx[1]);
    			attr_dev(p, "class", "description");
    			add_location(p, file$3, 14, 4, 312);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*description*/ 2) set_data_dev(t, /*description*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(14:4) {#if description}",
    		ctx
    	});

    	return block;
    }

    // (19:2) {#each items as item (item.id)}
    function create_each_block$1(key_1, ctx) {
    	let first;
    	let menuitem;
    	let current;
    	const menuitem_spread_levels = [/*item*/ ctx[5]];
    	let menuitem_props = {};

    	for (let i = 0; i < menuitem_spread_levels.length; i += 1) {
    		menuitem_props = assign(menuitem_props, menuitem_spread_levels[i]);
    	}

    	menuitem = new MenuItem({ props: menuitem_props, $$inline: true });

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(menuitem.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(menuitem, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const menuitem_changes = (dirty & /*items*/ 4)
    			? get_spread_update(menuitem_spread_levels, [get_spread_object(/*item*/ ctx[5])])
    			: {};

    			menuitem.$set(menuitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menuitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menuitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(menuitem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(19:2) {#each items as item (item.id)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let section;
    	let div;
    	let h2;
    	let t0;
    	let t1;
    	let t2;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let current;
    	let if_block = /*description*/ ctx[1] && create_if_block$1(ctx);
    	let each_value = /*items*/ ctx[2];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*item*/ ctx[5].id;
    	validate_each_keys(ctx, each_value, get_each_context$1, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$1(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			section = element("section");
    			div = element("div");
    			h2 = element("h2");
    			t0 = text(/*name*/ ctx[0]);
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(h2, file$3, 12, 4, 270);
    			attr_dev(div, "class", "details svelte-glovo3");
    			add_location(div, file$3, 11, 2, 244);
    			attr_dev(section, "class", "menu-section svelte-glovo3");
    			add_location(section, file$3, 10, 0, 211);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div);
    			append_dev(div, h2);
    			append_dev(h2, t0);
    			append_dev(div, t1);
    			if (if_block) if_block.m(div, null);
    			append_dev(section, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(section, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*name*/ 1) set_data_dev(t0, /*name*/ ctx[0]);

    			if (/*description*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*items*/ 4) {
    				const each_value = /*items*/ ctx[2];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context$1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, section, outro_and_destroy_block, create_each_block$1, null, get_each_context$1);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (if_block) if_block.d();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { name = "Menu Section" } = $$props;
    	let { description = false } = $$props;
    	let { id = false } = $$props;
    	let { order = 1 } = $$props;
    	let { items = [] } = $$props;
    	const writable_props = ["name", "description", "id", "order", "items"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MenuSection> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("MenuSection", $$slots, []);

    	$$self.$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("description" in $$props) $$invalidate(1, description = $$props.description);
    		if ("id" in $$props) $$invalidate(3, id = $$props.id);
    		if ("order" in $$props) $$invalidate(4, order = $$props.order);
    		if ("items" in $$props) $$invalidate(2, items = $$props.items);
    	};

    	$$self.$capture_state = () => ({
    		MenuItem,
    		name,
    		description,
    		id,
    		order,
    		items
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("description" in $$props) $$invalidate(1, description = $$props.description);
    		if ("id" in $$props) $$invalidate(3, id = $$props.id);
    		if ("order" in $$props) $$invalidate(4, order = $$props.order);
    		if ("items" in $$props) $$invalidate(2, items = $$props.items);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name, description, items, id, order];
    }

    class MenuSection extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			name: 0,
    			description: 1,
    			id: 3,
    			order: 4,
    			items: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MenuSection",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get name() {
    		throw new Error("<MenuSection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<MenuSection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get description() {
    		throw new Error("<MenuSection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set description(value) {
    		throw new Error("<MenuSection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<MenuSection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<MenuSection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get order() {
    		throw new Error("<MenuSection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set order(value) {
    		throw new Error("<MenuSection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get items() {
    		throw new Error("<MenuSection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set items(value) {
    		throw new Error("<MenuSection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function slide(node, { delay = 0, duration = 400, easing = cubicOut }) {
        const style = getComputedStyle(node);
        const opacity = +style.opacity;
        const height = parseFloat(style.height);
        const padding_top = parseFloat(style.paddingTop);
        const padding_bottom = parseFloat(style.paddingBottom);
        const margin_top = parseFloat(style.marginTop);
        const margin_bottom = parseFloat(style.marginBottom);
        const border_top_width = parseFloat(style.borderTopWidth);
        const border_bottom_width = parseFloat(style.borderBottomWidth);
        return {
            delay,
            duration,
            easing,
            css: t => `overflow: hidden;` +
                `opacity: ${Math.min(t * 20, 1) * opacity};` +
                `height: ${t * height}px;` +
                `padding-top: ${t * padding_top}px;` +
                `padding-bottom: ${t * padding_bottom}px;` +
                `margin-top: ${t * margin_top}px;` +
                `margin-bottom: ${t * margin_bottom}px;` +
                `border-top-width: ${t * border_top_width}px;` +
                `border-bottom-width: ${t * border_bottom_width}px;`
        };
    }

    /* src/order/OrderItem.svelte generated by Svelte v3.23.2 */
    const file$4 = "src/order/OrderItem.svelte";

    function create_fragment$4(ctx) {
    	let div3;
    	let div0;
    	let t0;
    	let t1;
    	let div1;
    	let button0;
    	let t3;
    	let input;
    	let t4;
    	let button1;
    	let t6;
    	let div2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			t0 = text(/*name*/ ctx[1]);
    			t1 = space();
    			div1 = element("div");
    			button0 = element("button");
    			button0.textContent = "-";
    			t3 = space();
    			input = element("input");
    			t4 = space();
    			button1 = element("button");
    			button1.textContent = "+";
    			t6 = space();
    			div2 = element("div");

    			div2.textContent = `
    £${/*total*/ ctx[2].toFixed(2)}`;

    			attr_dev(div0, "class", "details svelte-c41wh7");
    			add_location(div0, file$4, 27, 2, 476);
    			attr_dev(button0, "class", "minus");
    			add_location(button0, file$4, 31, 4, 544);
    			attr_dev(input, "type", "number");
    			attr_dev(input, "min", "0");
    			add_location(input, file$4, 32, 4, 599);
    			attr_dev(button1, "class", "plus");
    			add_location(button1, file$4, 33, 4, 669);
    			attr_dev(div1, "class", "count");
    			add_location(div1, file$4, 30, 2, 520);
    			attr_dev(div2, "class", "total svelte-c41wh7");
    			add_location(div2, file$4, 35, 2, 727);
    			attr_dev(div3, "class", "order-item svelte-c41wh7");
    			add_location(div3, file$4, 26, 0, 449);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, t0);
    			append_dev(div3, t1);
    			append_dev(div3, div1);
    			append_dev(div1, button0);
    			append_dev(div1, t3);
    			append_dev(div1, input);
    			set_input_value(input, /*count*/ ctx[0]);
    			append_dev(div1, t4);
    			append_dev(div1, button1);
    			append_dev(div3, t6);
    			append_dev(div3, div2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*remove*/ ctx[5], false, false, false),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[9]),
    					listen_dev(input, "change", /*update*/ ctx[3], false, false, false),
    					listen_dev(button1, "click", /*add*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 2) set_data_dev(t0, /*name*/ ctx[1]);

    			if (dirty & /*count*/ 1 && to_number(input.value) !== /*count*/ ctx[0]) {
    				set_input_value(input, /*count*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { id } = $$props;
    	let { name = "Order Item" } = $$props;
    	let { price = "0.00" } = $$props;
    	let { vat = true } = $$props;
    	let { count = 0 } = $$props;
    	let total = count * parseFloat(price);

    	function update() {
    		orderList.addOrUpdate({ id, name, price, vat, count });
    	}

    	function add() {
    		$$invalidate(0, count++, count);
    		update();
    	}

    	function remove() {
    		$$invalidate(0, count = Math.max(count - 1, 0));
    		update();
    	}

    	const writable_props = ["id", "name", "price", "vat", "count"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<OrderItem> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("OrderItem", $$slots, []);

    	function input_input_handler() {
    		count = to_number(this.value);
    		$$invalidate(0, count);
    	}

    	$$self.$set = $$props => {
    		if ("id" in $$props) $$invalidate(6, id = $$props.id);
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    		if ("price" in $$props) $$invalidate(7, price = $$props.price);
    		if ("vat" in $$props) $$invalidate(8, vat = $$props.vat);
    		if ("count" in $$props) $$invalidate(0, count = $$props.count);
    	};

    	$$self.$capture_state = () => ({
    		orderList,
    		id,
    		name,
    		price,
    		vat,
    		count,
    		total,
    		update,
    		add,
    		remove
    	});

    	$$self.$inject_state = $$props => {
    		if ("id" in $$props) $$invalidate(6, id = $$props.id);
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    		if ("price" in $$props) $$invalidate(7, price = $$props.price);
    		if ("vat" in $$props) $$invalidate(8, vat = $$props.vat);
    		if ("count" in $$props) $$invalidate(0, count = $$props.count);
    		if ("total" in $$props) $$invalidate(2, total = $$props.total);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [count, name, total, update, add, remove, id, price, vat, input_input_handler];
    }

    class OrderItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			id: 6,
    			name: 1,
    			price: 7,
    			vat: 8,
    			count: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "OrderItem",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*id*/ ctx[6] === undefined && !("id" in props)) {
    			console.warn("<OrderItem> was created without expected prop 'id'");
    		}
    	}

    	get id() {
    		throw new Error("<OrderItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<OrderItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get name() {
    		throw new Error("<OrderItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<OrderItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get price() {
    		throw new Error("<OrderItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set price(value) {
    		throw new Error("<OrderItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get vat() {
    		throw new Error("<OrderItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set vat(value) {
    		throw new Error("<OrderItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get count() {
    		throw new Error("<OrderItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set count(value) {
    		throw new Error("<OrderItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/order/Order.svelte generated by Svelte v3.23.2 */

    const { console: console_1 } = globals;
    const file$5 = "src/order/Order.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	return child_ctx;
    }

    // (43:0) {#if review}
    function create_if_block_2(ctx) {
    	let div;
    	let div_transition;
    	let current;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "cover svelte-l3uisy");
    			add_location(div, file$5, 43, 2, 1085);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(div, "click", /*click_handler*/ ctx[8], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, {}, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, {}, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching && div_transition) div_transition.end();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(43:0) {#if review}",
    		ctx
    	});

    	return block;
    }

    // (52:6) {#if !review}
    function create_if_block_1(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Review and place order";
    			add_location(button, file$5, 52, 6, 1372);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_1*/ ctx[9], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(52:6) {#if !review}",
    		ctx
    	});

    	return block;
    }

    // (59:6) {#if review}
    function create_if_block$2(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t0;
    	let div;
    	let button0;
    	let t1;
    	let button0_disabled_value;
    	let button1;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*$orderList*/ ctx[5];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*item*/ ctx[13].id;
    	validate_each_keys(ctx, each_value, get_each_context$2, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$2(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$2(key, child_ctx));
    	}

    	let each_1_else = null;

    	if (!each_value.length) {
    		each_1_else = create_else_block(ctx);
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (each_1_else) {
    				each_1_else.c();
    			}

    			t0 = space();
    			div = element("div");
    			button0 = element("button");
    			t1 = text("Place Order\n        ");
    			button1 = element("button");
    			button1.textContent = "Back to Menu";
    			button0.disabled = button0_disabled_value = !/*$orderList*/ ctx[5].length || /*ordering*/ ctx[4];
    			attr_dev(button0, "class", "svelte-l3uisy");
    			add_location(button0, file$5, 65, 8, 1704);
    			attr_dev(button1, "class", "svelte-l3uisy");
    			add_location(button1, file$5, 67, 17, 1851);
    			attr_dev(div, "class", "buttons svelte-l3uisy");
    			add_location(div, file$5, 64, 6, 1674);
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			if (each_1_else) {
    				each_1_else.m(target, anchor);
    			}

    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(button0, t1);
    			append_dev(div, button1);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler_2*/ ctx[10], false, false, false),
    					listen_dev(button0, "click", /*placeOrder*/ ctx[6], false, false, false),
    					listen_dev(button1, "click", /*click_handler_3*/ ctx[11], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$orderList*/ 32) {
    				const each_value = /*$orderList*/ ctx[5];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context$2, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, t0.parentNode, outro_and_destroy_block, create_each_block$2, t0, get_each_context$2);
    				check_outros();

    				if (each_value.length) {
    					if (each_1_else) {
    						each_1_else.d(1);
    						each_1_else = null;
    					}
    				} else if (!each_1_else) {
    					each_1_else = create_else_block(ctx);
    					each_1_else.c();
    					each_1_else.m(t0.parentNode, t0);
    				}
    			}

    			if (!current || dirty & /*$orderList, ordering*/ 48 && button0_disabled_value !== (button0_disabled_value = !/*$orderList*/ ctx[5].length || /*ordering*/ ctx[4])) {
    				prop_dev(button0, "disabled", button0_disabled_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (each_1_else) each_1_else.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(59:6) {#if review}",
    		ctx
    	});

    	return block;
    }

    // (62:6) {:else}
    function create_else_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Add something to your order to continue.";
    			add_location(p, file$5, 62, 6, 1606);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(62:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (60:6) {#each $orderList as item (item.id)}
    function create_each_block$2(key_1, ctx) {
    	let first;
    	let orderitem;
    	let current;
    	const orderitem_spread_levels = [/*item*/ ctx[13]];
    	let orderitem_props = {};

    	for (let i = 0; i < orderitem_spread_levels.length; i += 1) {
    		orderitem_props = assign(orderitem_props, orderitem_spread_levels[i]);
    	}

    	orderitem = new OrderItem({ props: orderitem_props, $$inline: true });

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(orderitem.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(orderitem, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const orderitem_changes = (dirty & /*$orderList*/ 32)
    			? get_spread_update(orderitem_spread_levels, [get_spread_object(/*item*/ ctx[13])])
    			: {};

    			orderitem.$set(orderitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(orderitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(orderitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(orderitem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(60:6) {#each $orderList as item (item.id)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let t0;
    	let div3;
    	let div2;
    	let nav;
    	let div0;
    	let h3;
    	let t1;
    	let t2;
    	let t3_value = /*total*/ ctx[1].toFixed(2) + "";
    	let t3;
    	let t4;
    	let t5;
    	let div1;
    	let current;
    	let if_block0 = /*review*/ ctx[3] && create_if_block_2(ctx);
    	let if_block1 = !/*review*/ ctx[3] && create_if_block_1(ctx);
    	let if_block2 = /*review*/ ctx[3] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			div3 = element("div");
    			div2 = element("div");
    			nav = element("nav");
    			div0 = element("div");
    			h3 = element("h3");
    			t1 = text(/*items*/ ctx[2]);
    			t2 = text(" Items - £");
    			t3 = text(t3_value);
    			t4 = space();
    			if (if_block1) if_block1.c();
    			t5 = space();
    			div1 = element("div");
    			if (if_block2) if_block2.c();
    			add_location(h3, file$5, 49, 8, 1288);
    			attr_dev(div0, "class", "details");
    			add_location(div0, file$5, 48, 6, 1258);
    			add_location(nav, file$5, 47, 4, 1246);
    			add_location(div1, file$5, 57, 4, 1488);
    			attr_dev(div2, "class", "inner svelte-l3uisy");
    			add_location(div2, file$5, 46, 2, 1222);
    			attr_dev(div3, "class", "order svelte-l3uisy");
    			toggle_class(div3, "review", /*review*/ ctx[3]);
    			add_location(div3, file$5, 45, 0, 1167);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, nav);
    			append_dev(nav, div0);
    			append_dev(div0, h3);
    			append_dev(h3, t1);
    			append_dev(h3, t2);
    			append_dev(h3, t3);
    			append_dev(nav, t4);
    			if (if_block1) if_block1.m(nav, null);
    			append_dev(div2, t5);
    			append_dev(div2, div1);
    			if (if_block2) if_block2.m(div1, null);
    			/*div3_binding*/ ctx[12](div3);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*review*/ ctx[3]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*review*/ 8) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty & /*items*/ 4) set_data_dev(t1, /*items*/ ctx[2]);
    			if ((!current || dirty & /*total*/ 2) && t3_value !== (t3_value = /*total*/ ctx[1].toFixed(2) + "")) set_data_dev(t3, t3_value);

    			if (!/*review*/ ctx[3]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					if_block1.m(nav, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*review*/ ctx[3]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty & /*review*/ 8) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block$2(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(div1, null);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			if (dirty & /*review*/ 8) {
    				toggle_class(div3, "review", /*review*/ ctx[3]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block2);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block2);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div3);
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			/*div3_binding*/ ctx[12](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let $orderList;
    	validate_store(orderList, "orderList");
    	component_subscribe($$self, orderList, $$value => $$invalidate(5, $orderList = $$value));
    	let { orderElHeight = 0 } = $$props;
    	let orderEl;
    	let total = 0;
    	let items = 0;
    	let review = false;
    	let ordering = false;
    	onMount(() => $$invalidate(7, orderElHeight = orderEl.offsetHeight));

    	function placeOrder() {
    		$$invalidate(4, ordering = true);

    		let order = $orderList.map(item => {
    			return { item: item.id, count: item.count };
    		});

    		console.log({ order });

    		post("order/", { order }).then(response => {
    			if (response.status === 204) {
    				orderList.set([]);
    				$$invalidate(3, review = false);
    			} else console.log(response);

    			$$invalidate(4, ordering = false);
    		});
    	}

    	const writable_props = ["orderElHeight"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Order> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Order", $$slots, []);
    	const click_handler = () => $$invalidate(3, review = false);
    	const click_handler_1 = () => $$invalidate(3, review = true);
    	const click_handler_2 = () => $$invalidate(3, review = true);
    	const click_handler_3 = () => $$invalidate(3, review = false);

    	function div3_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			orderEl = $$value;
    			$$invalidate(0, orderEl);
    		});
    	}

    	$$self.$set = $$props => {
    		if ("orderElHeight" in $$props) $$invalidate(7, orderElHeight = $$props.orderElHeight);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		fade,
    		OrderItem,
    		post,
    		orderList,
    		orderElHeight,
    		orderEl,
    		total,
    		items,
    		review,
    		ordering,
    		placeOrder,
    		$orderList
    	});

    	$$self.$inject_state = $$props => {
    		if ("orderElHeight" in $$props) $$invalidate(7, orderElHeight = $$props.orderElHeight);
    		if ("orderEl" in $$props) $$invalidate(0, orderEl = $$props.orderEl);
    		if ("total" in $$props) $$invalidate(1, total = $$props.total);
    		if ("items" in $$props) $$invalidate(2, items = $$props.items);
    		if ("review" in $$props) $$invalidate(3, review = $$props.review);
    		if ("ordering" in $$props) $$invalidate(4, ordering = $$props.ordering);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$orderList*/ 32) {
    			 {
    				$$invalidate(1, total = $orderList.reduce((acc, cur) => acc + parseFloat(cur.price) * cur.count, 0));
    				$$invalidate(2, items = $orderList.reduce((acc, cur) => acc + cur.count, 0));
    			}
    		}

    		if ($$self.$$.dirty & /*review*/ 8) {
    			 {
    				if (review) document.body.style = "overflow: hidden;"; else document.body.style = "";
    			}
    		}
    	};

    	return [
    		orderEl,
    		total,
    		items,
    		review,
    		ordering,
    		$orderList,
    		placeOrder,
    		orderElHeight,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		div3_binding
    	];
    }

    class Order extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { orderElHeight: 7 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Order",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get orderElHeight() {
    		throw new Error("<Order>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set orderElHeight(value) {
    		throw new Error("<Order>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/menu/Menu.svelte generated by Svelte v3.23.2 */
    const file$6 = "src/menu/Menu.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (20:2) {:catch error}
    function create_catch_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Oops something went wrong when trying to load the menu.";
    			add_location(p, file$6, 20, 2, 511);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block.name,
    		type: "catch",
    		source: "(20:2) {:catch error}",
    		ctx
    	});

    	return block;
    }

    // (16:2) {:then sections}
    function create_then_block(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let current;
    	let each_value = /*sections*/ ctx[3];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*section*/ ctx[4].id;
    	validate_each_keys(ctx, each_value, get_each_context$3, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$3(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$3(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*menuItems*/ 2) {
    				const each_value = /*sections*/ ctx[3];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context$3, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block$3, each_1_anchor, get_each_context$3);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block.name,
    		type: "then",
    		source: "(16:2) {:then sections}",
    		ctx
    	});

    	return block;
    }

    // (17:2) {#each sections as section (section.id)}
    function create_each_block$3(key_1, ctx) {
    	let first;
    	let menusection;
    	let current;
    	const menusection_spread_levels = [/*section*/ ctx[4]];
    	let menusection_props = {};

    	for (let i = 0; i < menusection_spread_levels.length; i += 1) {
    		menusection_props = assign(menusection_props, menusection_spread_levels[i]);
    	}

    	menusection = new MenuSection({ props: menusection_props, $$inline: true });

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(menusection.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(menusection, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const menusection_changes = (dirty & /*menuItems*/ 2)
    			? get_spread_update(menusection_spread_levels, [get_spread_object(/*section*/ ctx[4])])
    			: {};

    			menusection.$set(menusection_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menusection.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menusection.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(menusection, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(17:2) {#each sections as section (section.id)}",
    		ctx
    	});

    	return block;
    }

    // (14:20)    <p>Loading Menu</p>   {:then sections}
    function create_pending_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Loading Menu";
    			add_location(p, file$6, 14, 2, 369);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block.name,
    		type: "pending",
    		source: "(14:20)    <p>Loading Menu</p>   {:then sections}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let article;
    	let h1;
    	let t1;
    	let promise;
    	let t2;
    	let order;
    	let updating_orderElHeight;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block,
    		value: 3,
    		error: 7,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*menuItems*/ ctx[1], info);

    	function order_orderElHeight_binding(value) {
    		/*order_orderElHeight_binding*/ ctx[2].call(null, value);
    	}

    	let order_props = {};

    	if (/*orderElHeight*/ ctx[0] !== void 0) {
    		order_props.orderElHeight = /*orderElHeight*/ ctx[0];
    	}

    	order = new Order({ props: order_props, $$inline: true });
    	binding_callbacks.push(() => bind(order, "orderElHeight", order_orderElHeight_binding));

    	const block = {
    		c: function create() {
    			article = element("article");
    			h1 = element("h1");
    			h1.textContent = "Menu";
    			t1 = space();
    			info.block.c();
    			t2 = space();
    			create_component(order.$$.fragment);
    			attr_dev(h1, "class", "svelte-1wdv9cp");
    			add_location(h1, file$6, 12, 2, 332);
    			set_style(article, "padding-bottom", /*orderElHeight*/ ctx[0] + "px");
    			add_location(article, file$6, 11, 0, 277);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, article, anchor);
    			append_dev(article, h1);
    			append_dev(article, t1);
    			info.block.m(article, info.anchor = null);
    			info.mount = () => article;
    			info.anchor = null;
    			insert_dev(target, t2, anchor);
    			mount_component(order, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			{
    				const child_ctx = ctx.slice();
    				child_ctx[3] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}

    			if (!current || dirty & /*orderElHeight*/ 1) {
    				set_style(article, "padding-bottom", /*orderElHeight*/ ctx[0] + "px");
    			}

    			const order_changes = {};

    			if (!updating_orderElHeight && dirty & /*orderElHeight*/ 1) {
    				updating_orderElHeight = true;
    				order_changes.orderElHeight = /*orderElHeight*/ ctx[0];
    				add_flush_callback(() => updating_orderElHeight = false);
    			}

    			order.$set(order_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(info.block);
    			transition_in(order.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			transition_out(order.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(article);
    			info.block.d();
    			info.token = null;
    			info = null;
    			if (detaching) detach_dev(t2);
    			destroy_component(order, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let orderElHeight;
    	let menuItems = fetch("/menu/").then(response => response.json()).then(data => data.sections);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Menu> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Menu", $$slots, []);

    	function order_orderElHeight_binding(value) {
    		orderElHeight = value;
    		$$invalidate(0, orderElHeight);
    	}

    	$$self.$capture_state = () => ({
    		MenuSection,
    		Order,
    		orderElHeight,
    		menuItems
    	});

    	$$self.$inject_state = $$props => {
    		if ("orderElHeight" in $$props) $$invalidate(0, orderElHeight = $$props.orderElHeight);
    		if ("menuItems" in $$props) $$invalidate(1, menuItems = $$props.menuItems);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [orderElHeight, menuItems, order_orderElHeight_binding];
    }

    class Menu extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Menu",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/dashboard/OrderList.svelte generated by Svelte v3.23.2 */
    const file$7 = "src/dashboard/OrderList.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	return child_ctx;
    }

    // (8:0) {#each orders as order (order.id)}
    function create_each_block$4(key_1, ctx) {
    	let div3;
    	let div0;
    	let t0_value = /*order*/ ctx[3].group + "";
    	let t0;
    	let t1;
    	let t2_value = /*order*/ ctx[3].no_items + "";
    	let t2;
    	let t3;
    	let t4_value = (/*order*/ ctx[3].paid ? "- PAID" : "") + "";
    	let t4;
    	let t5;
    	let div1;
    	let t6;
    	let t7_value = /*order*/ ctx[3].total + "";
    	let t7;
    	let t8;
    	let div2;
    	let button;
    	let t10;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[2](/*order*/ ctx[3], ...args);
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = text(" - ");
    			t2 = text(t2_value);
    			t3 = text(" items ");
    			t4 = text(t4_value);
    			t5 = space();
    			div1 = element("div");
    			t6 = text("£");
    			t7 = text(t7_value);
    			t8 = space();
    			div2 = element("div");
    			button = element("button");
    			button.textContent = "Review Order";
    			t10 = space();
    			attr_dev(div0, "class", "details svelte-tkjqpa");
    			add_location(div0, file$7, 9, 4, 197);
    			attr_dev(div1, "class", "total svelte-tkjqpa");
    			add_location(div1, file$7, 12, 4, 308);
    			add_location(button, file$7, 16, 6, 376);
    			add_location(div2, file$7, 15, 4, 364);
    			attr_dev(div3, "class", "order svelte-tkjqpa");
    			add_location(div3, file$7, 8, 2, 173);
    			this.first = div3;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, t2);
    			append_dev(div0, t3);
    			append_dev(div0, t4);
    			append_dev(div3, t5);
    			append_dev(div3, div1);
    			append_dev(div1, t6);
    			append_dev(div1, t7);
    			append_dev(div3, t8);
    			append_dev(div3, div2);
    			append_dev(div2, button);
    			append_dev(div3, t10);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*orders*/ 1 && t0_value !== (t0_value = /*order*/ ctx[3].group + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*orders*/ 1 && t2_value !== (t2_value = /*order*/ ctx[3].no_items + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*orders*/ 1 && t4_value !== (t4_value = (/*order*/ ctx[3].paid ? "- PAID" : "") + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*orders*/ 1 && t7_value !== (t7_value = /*order*/ ctx[3].total + "")) set_data_dev(t7, t7_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$4.name,
    		type: "each",
    		source: "(8:0) {#each orders as order (order.id)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let each_value = /*orders*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*order*/ ctx[3].id;
    	validate_each_keys(ctx, each_value, get_each_context$4, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$4(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$4(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*dispatch, orders*/ 3) {
    				const each_value = /*orders*/ ctx[0];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$4, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, destroy_block, create_each_block$4, each_1_anchor, get_each_context$4);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { orders } = $$props;
    	const dispatch = createEventDispatcher();
    	const writable_props = ["orders"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<OrderList> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("OrderList", $$slots, []);
    	const click_handler = order => dispatch("editorder", order);

    	$$self.$set = $$props => {
    		if ("orders" in $$props) $$invalidate(0, orders = $$props.orders);
    	};

    	$$self.$capture_state = () => ({ createEventDispatcher, orders, dispatch });

    	$$self.$inject_state = $$props => {
    		if ("orders" in $$props) $$invalidate(0, orders = $$props.orders);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [orders, dispatch, click_handler];
    }

    class OrderList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { orders: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "OrderList",
    			options,
    			id: create_fragment$7.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*orders*/ ctx[0] === undefined && !("orders" in props)) {
    			console.warn("<OrderList> was created without expected prop 'orders'");
    		}
    	}

    	get orders() {
    		throw new Error("<OrderList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set orders(value) {
    		throw new Error("<OrderList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/order/OrderReview.svelte generated by Svelte v3.23.2 */

    const file$8 = "src/order/OrderReview.svelte";

    function get_each_context$5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	child_ctx[5] = i;
    	return child_ctx;
    }

    // (14:2) {#each order.order_items as item, i (i)}
    function create_each_block$5(key_1, ctx) {
    	let div3;
    	let div0;
    	let t0_value = /*item*/ ctx[3].item_name + "";
    	let t0;
    	let t1;
    	let div1;
    	let t2_value = /*item*/ ctx[3].count + "";
    	let t2;
    	let t3;
    	let div2;
    	let t4;
    	let t5_value = /*item*/ ctx[3].total + "";
    	let t5;
    	let t6;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			t4 = text("£");
    			t5 = text(t5_value);
    			t6 = space();
    			attr_dev(div0, "class", "item svelte-7vgosy");
    			add_location(div0, file$8, 15, 4, 414);
    			attr_dev(div1, "class", "count");
    			add_location(div1, file$8, 18, 4, 471);
    			attr_dev(div2, "class", "total svelte-7vgosy");
    			add_location(div2, file$8, 21, 4, 525);
    			attr_dev(div3, "class", "item-row svelte-7vgosy");
    			add_location(div3, file$8, 14, 2, 387);
    			this.first = div3;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, t0);
    			append_dev(div3, t1);
    			append_dev(div3, div1);
    			append_dev(div1, t2);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div2, t4);
    			append_dev(div2, t5);
    			append_dev(div3, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*order*/ 1 && t0_value !== (t0_value = /*item*/ ctx[3].item_name + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*order*/ 1 && t2_value !== (t2_value = /*item*/ ctx[3].count + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*order*/ 1 && t5_value !== (t5_value = /*item*/ ctx[3].total + "")) set_data_dev(t5, t5_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$5.name,
    		type: "each",
    		source: "(14:2) {#each order.order_items as item, i (i)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let div0;
    	let h2;
    	let t0_value = /*order*/ ctx[0].group + "";
    	let t0;
    	let t1;
    	let h3;
    	let t2_value = /*order*/ ctx[0].no_items + "";
    	let t2;
    	let t3;
    	let t4_value = (/*order*/ ctx[0].no_items > 1 ? "s" : "") + "";
    	let t4;
    	let t5;
    	let t6_value = /*order*/ ctx[0].total + "";
    	let t6;
    	let t7_value = (/*order*/ ctx[0].paid ? " - PAID" : "") + "";
    	let t7;
    	let t8;
    	let h4;
    	let t12;
    	let div1;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t13;
    	let div8;
    	let div4;
    	let div2;
    	let t15;
    	let div3;
    	let t16;
    	let t17_value = /*order*/ ctx[0].total + "";
    	let t17;
    	let t18;
    	let div7;
    	let div5;
    	let t20;
    	let div6;
    	let t21;
    	let t22_value = /*order*/ ctx[0].vat_total + "";
    	let t22;
    	let each_value = /*order*/ ctx[0].order_items;
    	validate_each_argument(each_value);
    	const get_key = ctx => /*i*/ ctx[5];
    	validate_each_keys(ctx, each_value, get_each_context$5, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$5(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$5(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h2 = element("h2");
    			t0 = text(t0_value);
    			t1 = space();
    			h3 = element("h3");
    			t2 = text(t2_value);
    			t3 = text(" item");
    			t4 = text(t4_value);
    			t5 = text(" - £");
    			t6 = text(t6_value);
    			t7 = text(t7_value);
    			t8 = space();
    			h4 = element("h4");
    			h4.textContent = `${/*time*/ ctx[2]} - ${/*date*/ ctx[1]}`;
    			t12 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t13 = space();
    			div8 = element("div");
    			div4 = element("div");
    			div2 = element("div");
    			div2.textContent = "Total:";
    			t15 = space();
    			div3 = element("div");
    			t16 = text("£");
    			t17 = text(t17_value);
    			t18 = space();
    			div7 = element("div");
    			div5 = element("div");
    			div5.textContent = "inc VAT";
    			t20 = space();
    			div6 = element("div");
    			t21 = text("£");
    			t22 = text(t22_value);
    			add_location(h2, file$8, 8, 0, 152);
    			add_location(h3, file$8, 9, 0, 175);
    			add_location(h4, file$8, 10, 0, 283);
    			attr_dev(div0, "class", "center");
    			add_location(div0, file$8, 7, 0, 131);
    			attr_dev(div1, "class", "reciept-list svelte-7vgosy");
    			add_location(div1, file$8, 12, 0, 315);
    			attr_dev(div2, "class", "item svelte-7vgosy");
    			add_location(div2, file$8, 29, 4, 660);
    			attr_dev(div3, "class", "total svelte-7vgosy");
    			add_location(div3, file$8, 32, 4, 707);
    			attr_dev(div4, "class", "item-row svelte-7vgosy");
    			add_location(div4, file$8, 28, 2, 633);
    			attr_dev(div5, "class", "item svelte-7vgosy");
    			add_location(div5, file$8, 37, 4, 797);
    			attr_dev(div6, "class", "total svelte-7vgosy");
    			add_location(div6, file$8, 40, 4, 845);
    			attr_dev(div7, "class", "item-row svelte-7vgosy");
    			add_location(div7, file$8, 36, 2, 770);
    			attr_dev(div8, "class", "reciept-totals svelte-7vgosy");
    			add_location(div8, file$8, 27, 0, 602);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h2);
    			append_dev(h2, t0);
    			append_dev(div0, t1);
    			append_dev(div0, h3);
    			append_dev(h3, t2);
    			append_dev(h3, t3);
    			append_dev(h3, t4);
    			append_dev(h3, t5);
    			append_dev(h3, t6);
    			append_dev(h3, t7);
    			append_dev(div0, t8);
    			append_dev(div0, h4);
    			insert_dev(target, t12, anchor);
    			insert_dev(target, div1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			insert_dev(target, t13, anchor);
    			insert_dev(target, div8, anchor);
    			append_dev(div8, div4);
    			append_dev(div4, div2);
    			append_dev(div4, t15);
    			append_dev(div4, div3);
    			append_dev(div3, t16);
    			append_dev(div3, t17);
    			append_dev(div8, t18);
    			append_dev(div8, div7);
    			append_dev(div7, div5);
    			append_dev(div7, t20);
    			append_dev(div7, div6);
    			append_dev(div6, t21);
    			append_dev(div6, t22);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*order*/ 1 && t0_value !== (t0_value = /*order*/ ctx[0].group + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*order*/ 1 && t2_value !== (t2_value = /*order*/ ctx[0].no_items + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*order*/ 1 && t4_value !== (t4_value = (/*order*/ ctx[0].no_items > 1 ? "s" : "") + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*order*/ 1 && t6_value !== (t6_value = /*order*/ ctx[0].total + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*order*/ 1 && t7_value !== (t7_value = (/*order*/ ctx[0].paid ? " - PAID" : "") + "")) set_data_dev(t7, t7_value);

    			if (dirty & /*order*/ 1) {
    				const each_value = /*order*/ ctx[0].order_items;
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$5, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div1, destroy_block, create_each_block$5, null, get_each_context$5);
    			}

    			if (dirty & /*order*/ 1 && t17_value !== (t17_value = /*order*/ ctx[0].total + "")) set_data_dev(t17, t17_value);
    			if (dirty & /*order*/ 1 && t22_value !== (t22_value = /*order*/ ctx[0].vat_total + "")) set_data_dev(t22, t22_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t12);
    			if (detaching) detach_dev(div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (detaching) detach_dev(t13);
    			if (detaching) detach_dev(div8);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { order } = $$props;
    	let date = order.time.split("T")[0];
    	let time = order.time.split("T")[1].slice(0, 8);
    	const writable_props = ["order"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<OrderReview> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("OrderReview", $$slots, []);

    	$$self.$set = $$props => {
    		if ("order" in $$props) $$invalidate(0, order = $$props.order);
    	};

    	$$self.$capture_state = () => ({ order, date, time });

    	$$self.$inject_state = $$props => {
    		if ("order" in $$props) $$invalidate(0, order = $$props.order);
    		if ("date" in $$props) $$invalidate(1, date = $$props.date);
    		if ("time" in $$props) $$invalidate(2, time = $$props.time);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [order, date, time];
    }

    class OrderReview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { order: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "OrderReview",
    			options,
    			id: create_fragment$8.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*order*/ ctx[0] === undefined && !("order" in props)) {
    			console.warn("<OrderReview> was created without expected prop 'order'");
    		}
    	}

    	get order() {
    		throw new Error("<OrderReview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set order(value) {
    		throw new Error("<OrderReview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/dashboard/DailyOrders.svelte generated by Svelte v3.23.2 */

    const { console: console_1$1 } = globals;
    const file$9 = "src/dashboard/DailyOrders.svelte";

    // (75:2) {:catch error}
    function create_catch_block$1(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Oops something went wrong when trying to load today's orders!";
    			add_location(p, file$9, 75, 2, 2367);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block$1.name,
    		type: "catch",
    		source: "(75:2) {:catch error}",
    		ctx
    	});

    	return block;
    }

    // (54:2) {:then orders}
    function create_then_block$1(ctx) {
    	let div0;
    	let h30;
    	let t1;
    	let p0;
    	let t3;
    	let orderlist0;
    	let t4;
    	let div1;
    	let h31;
    	let t6;
    	let p1;
    	let t8;
    	let orderlist1;
    	let t9;
    	let div2;
    	let h32;
    	let t11;
    	let p2;
    	let t13;
    	let orderlist2;
    	let t14;
    	let div3;
    	let h33;
    	let t16;
    	let p3;
    	let t18;
    	let orderlist3;
    	let current;

    	orderlist0 = new OrderList({
    			props: { orders: /*orders*/ ctx[10].filter(func) },
    			$$inline: true
    		});

    	orderlist0.$on("editorder", /*editOrder*/ ctx[3]);

    	orderlist1 = new OrderList({
    			props: {
    				orders: /*orders*/ ctx[10].filter(func_1)
    			},
    			$$inline: true
    		});

    	orderlist1.$on("editorder", /*editOrder*/ ctx[3]);

    	orderlist2 = new OrderList({
    			props: {
    				orders: /*orders*/ ctx[10].filter(func_2)
    			},
    			$$inline: true
    		});

    	orderlist2.$on("editorder", /*editOrder*/ ctx[3]);

    	orderlist3 = new OrderList({
    			props: {
    				orders: /*orders*/ ctx[10].filter(func_3)
    			},
    			$$inline: true
    		});

    	orderlist3.$on("editorder", /*editOrder*/ ctx[3]);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Pending";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "These orders haven't been sarted yet";
    			t3 = space();
    			create_component(orderlist0.$$.fragment);
    			t4 = space();
    			div1 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Accepted";
    			t6 = space();
    			p1 = element("p");
    			p1.textContent = "These orders are being worked on";
    			t8 = space();
    			create_component(orderlist1.$$.fragment);
    			t9 = space();
    			div2 = element("div");
    			h32 = element("h3");
    			h32.textContent = "Completed";
    			t11 = space();
    			p2 = element("p");
    			p2.textContent = "These orders have been served, but not paid";
    			t13 = space();
    			create_component(orderlist2.$$.fragment);
    			t14 = space();
    			div3 = element("div");
    			h33 = element("h3");
    			h33.textContent = "Paid";
    			t16 = space();
    			p3 = element("p");
    			p3.textContent = "These orders have been completed and paid";
    			t18 = space();
    			create_component(orderlist3.$$.fragment);
    			add_location(h30, file$9, 55, 4, 1531);
    			add_location(p0, file$9, 56, 4, 1552);
    			attr_dev(div0, "class", "order-list");
    			add_location(div0, file$9, 54, 2, 1502);
    			add_location(h31, file$9, 60, 4, 1729);
    			add_location(p1, file$9, 61, 4, 1751);
    			attr_dev(div1, "class", "order-list");
    			add_location(div1, file$9, 59, 2, 1700);
    			add_location(h32, file$9, 65, 4, 1943);
    			add_location(p2, file$9, 66, 4, 1966);
    			attr_dev(div2, "class", "order-list");
    			add_location(div2, file$9, 64, 2, 1914);
    			add_location(h33, file$9, 70, 4, 2165);
    			add_location(p3, file$9, 71, 4, 2183);
    			attr_dev(div3, "class", "order-list");
    			add_location(div3, file$9, 69, 2, 2136);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h30);
    			append_dev(div0, t1);
    			append_dev(div0, p0);
    			append_dev(div0, t3);
    			mount_component(orderlist0, div0, null);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h31);
    			append_dev(div1, t6);
    			append_dev(div1, p1);
    			append_dev(div1, t8);
    			mount_component(orderlist1, div1, null);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h32);
    			append_dev(div2, t11);
    			append_dev(div2, p2);
    			append_dev(div2, t13);
    			mount_component(orderlist2, div2, null);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h33);
    			append_dev(div3, t16);
    			append_dev(div3, p3);
    			append_dev(div3, t18);
    			mount_component(orderlist3, div3, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const orderlist0_changes = {};
    			if (dirty & /*todaysOrders*/ 4) orderlist0_changes.orders = /*orders*/ ctx[10].filter(func);
    			orderlist0.$set(orderlist0_changes);
    			const orderlist1_changes = {};
    			if (dirty & /*todaysOrders*/ 4) orderlist1_changes.orders = /*orders*/ ctx[10].filter(func_1);
    			orderlist1.$set(orderlist1_changes);
    			const orderlist2_changes = {};
    			if (dirty & /*todaysOrders*/ 4) orderlist2_changes.orders = /*orders*/ ctx[10].filter(func_2);
    			orderlist2.$set(orderlist2_changes);
    			const orderlist3_changes = {};
    			if (dirty & /*todaysOrders*/ 4) orderlist3_changes.orders = /*orders*/ ctx[10].filter(func_3);
    			orderlist3.$set(orderlist3_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(orderlist0.$$.fragment, local);
    			transition_in(orderlist1.$$.fragment, local);
    			transition_in(orderlist2.$$.fragment, local);
    			transition_in(orderlist3.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(orderlist0.$$.fragment, local);
    			transition_out(orderlist1.$$.fragment, local);
    			transition_out(orderlist2.$$.fragment, local);
    			transition_out(orderlist3.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			destroy_component(orderlist0);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div1);
    			destroy_component(orderlist1);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(div2);
    			destroy_component(orderlist2);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(div3);
    			destroy_component(orderlist3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block$1.name,
    		type: "then",
    		source: "(54:2) {:then orders}",
    		ctx
    	});

    	return block;
    }

    // (52:23)    <p>Loading Orders</p>   {:then orders}
    function create_pending_block$1(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Loading Orders";
    			add_location(p, file$9, 52, 2, 1461);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block$1.name,
    		type: "pending",
    		source: "(52:23)    <p>Loading Orders</p>   {:then orders}",
    		ctx
    	});

    	return block;
    }

    // (80:0) {#if review}
    function create_if_block$3(ctx) {
    	let div0;
    	let div0_transition;
    	let t0;
    	let div3;
    	let div2;
    	let orderreview;
    	let t1;
    	let div1;
    	let t2;
    	let t3;
    	let button;
    	let div3_transition;
    	let current;
    	let mounted;
    	let dispose;

    	orderreview = new OrderReview({
    			props: { order: /*review*/ ctx[0] },
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (!/*review*/ ctx[0].accepted) return create_if_block_2$1;
    		if (!/*review*/ ctx[0].completed) return create_if_block_3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);
    	let if_block1 = !/*review*/ ctx[0].paid && create_if_block_1$1(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t0 = space();
    			div3 = element("div");
    			div2 = element("div");
    			create_component(orderreview.$$.fragment);
    			t1 = space();
    			div1 = element("div");
    			if (if_block0) if_block0.c();
    			t2 = space();
    			if (if_block1) if_block1.c();
    			t3 = space();
    			button = element("button");
    			button.textContent = "Back to orders";
    			attr_dev(div0, "class", "cover svelte-18xk9xl");
    			add_location(div0, file$9, 80, 0, 2468);
    			attr_dev(div1, "class", "buttons svelte-18xk9xl");
    			add_location(div1, file$9, 84, 4, 2643);
    			add_location(button, file$9, 94, 4, 3081);
    			attr_dev(div2, "class", "inner svelte-18xk9xl");
    			add_location(div2, file$9, 82, 2, 2584);
    			attr_dev(div3, "class", "review svelte-18xk9xl");
    			add_location(div3, file$9, 81, 0, 2544);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			mount_component(orderreview, div2, null);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev(div1, t2);
    			if (if_block1) if_block1.m(div1, null);
    			append_dev(div2, t3);
    			append_dev(div2, button);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div0, "click", /*click_handler*/ ctx[5], false, false, false),
    					listen_dev(button, "click", /*click_handler_4*/ ctx[9], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const orderreview_changes = {};
    			if (dirty & /*review*/ 1) orderreview_changes.order = /*review*/ ctx[0];
    			orderreview.$set(orderreview_changes);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div1, t2);
    				}
    			}

    			if (!/*review*/ ctx[0].paid) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$1(ctx);
    					if_block1.c();
    					if_block1.m(div1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div0_transition) div0_transition = create_bidirectional_transition(div0, fade, {}, true);
    				div0_transition.run(1);
    			});

    			transition_in(orderreview.$$.fragment, local);

    			add_render_callback(() => {
    				if (!div3_transition) div3_transition = create_bidirectional_transition(div3, slide, {}, true);
    				div3_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div0_transition) div0_transition = create_bidirectional_transition(div0, fade, {}, false);
    			div0_transition.run(0);
    			transition_out(orderreview.$$.fragment, local);
    			if (!div3_transition) div3_transition = create_bidirectional_transition(div3, slide, {}, false);
    			div3_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching && div0_transition) div0_transition.end();
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div3);
    			destroy_component(orderreview);

    			if (if_block0) {
    				if_block0.d();
    			}

    			if (if_block1) if_block1.d();
    			if (detaching && div3_transition) div3_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(80:0) {#if review}",
    		ctx
    	});

    	return block;
    }

    // (88:34) 
    function create_if_block_3(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("Completed");
    			button.disabled = /*sending*/ ctx[1];
    			attr_dev(button, "class", "svelte-18xk9xl");
    			add_location(button, file$9, 88, 6, 2833);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_2*/ ctx[7], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*sending*/ 2) {
    				prop_dev(button, "disabled", /*sending*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(88:34) ",
    		ctx
    	});

    	return block;
    }

    // (86:6) {#if !review.accepted}
    function create_if_block_2$1(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("Accepted");
    			button.disabled = /*sending*/ ctx[1];
    			attr_dev(button, "class", "svelte-18xk9xl");
    			add_location(button, file$9, 86, 6, 2700);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_1*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*sending*/ 2) {
    				prop_dev(button, "disabled", /*sending*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(86:6) {#if !review.accepted}",
    		ctx
    	});

    	return block;
    }

    // (91:6) {#if !review.paid}
    function create_if_block_1$1(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("Paid");
    			button.disabled = /*sending*/ ctx[1];
    			attr_dev(button, "class", "svelte-18xk9xl");
    			add_location(button, file$9, 91, 6, 2970);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_3*/ ctx[8], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*sending*/ 2) {
    				prop_dev(button, "disabled", /*sending*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(91:6) {#if !review.paid}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let h2;
    	let t1;
    	let div;
    	let promise;
    	let t2;
    	let if_block_anchor;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		pending: create_pending_block$1,
    		then: create_then_block$1,
    		catch: create_catch_block$1,
    		value: 10,
    		error: 11,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*todaysOrders*/ ctx[2], info);
    	let if_block = /*review*/ ctx[0] && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Today's Orders";
    			t1 = space();
    			div = element("div");
    			info.block.c();
    			t2 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			add_location(h2, file$9, 49, 0, 1405);
    			add_location(div, file$9, 50, 0, 1429);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			info.block.m(div, info.anchor = null);
    			info.mount = () => div;
    			info.anchor = null;
    			insert_dev(target, t2, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*todaysOrders*/ 4 && promise !== (promise = /*todaysOrders*/ ctx[2]) && handle_promise(promise, info)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[10] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}

    			if (/*review*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*review*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(info.block);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			info.block.d();
    			info.token = null;
    			info = null;
    			if (detaching) detach_dev(t2);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func = order => !order.accepted;
    const func_1 = order => order.accepted && !order.completed;
    const func_2 = order => order.completed && !order.paid;
    const func_3 = order => order.completed && order.paid;

    function instance$9($$self, $$props, $$invalidate) {
    	let review = false;
    	let sending = false;

    	let todaysOrders = fetch("/orders/").then(response => {
    		if (response.status === 200) return response.json(); else if (response.status === 403) window.location.replace("/admin/login/?next=/dashboard/");
    	}).then(data => data.orders);

    	function editOrder(e) {
    		$$invalidate(0, review = e.detail);
    	}

    	function sendUpdateOrder(flag) {
    		$$invalidate(1, sending = true);
    		let data = {};
    		data[flag] = true;

    		patch(`/orders/${review.id}/`, data).then(response => {
    			if (response.status === 200) {
    				return response.json();
    			}
    		}).then(updatedOrder => {
    			todaysOrders.then(currentOrders => {
    				const updatedOrderIndex = currentOrders.findIndex(order => order.id === updatedOrder.id);
    				if (updatedOrderIndex >= 0) currentOrders[updatedOrderIndex] = updatedOrder;
    				$$invalidate(1, sending = false);
    				console.log(currentOrders);
    				return currentOrders;
    			});

    			$$invalidate(2, todaysOrders);
    			$$invalidate(0, review = updatedOrder);
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<DailyOrders> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("DailyOrders", $$slots, []);
    	const click_handler = () => $$invalidate(0, review = false);
    	const click_handler_1 = () => sendUpdateOrder("accepted");
    	const click_handler_2 = () => sendUpdateOrder("completed");
    	const click_handler_3 = () => sendUpdateOrder("paid");
    	const click_handler_4 = () => $$invalidate(0, review = false);

    	$$self.$capture_state = () => ({
    		fade,
    		slide,
    		OrderList,
    		OrderReview,
    		patch,
    		review,
    		sending,
    		todaysOrders,
    		editOrder,
    		sendUpdateOrder
    	});

    	$$self.$inject_state = $$props => {
    		if ("review" in $$props) $$invalidate(0, review = $$props.review);
    		if ("sending" in $$props) $$invalidate(1, sending = $$props.sending);
    		if ("todaysOrders" in $$props) $$invalidate(2, todaysOrders = $$props.todaysOrders);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*review*/ 1) {
    			 {
    				if (review) document.body.style = "overflow: hidden;"; else document.body.style = "";
    			}
    		}
    	};

    	return [
    		review,
    		sending,
    		todaysOrders,
    		editOrder,
    		sendUpdateOrder,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4
    	];
    }

    class DailyOrders extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DailyOrders",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src/dashboard/Dashboard.svelte generated by Svelte v3.23.2 */
    const file$a = "src/dashboard/Dashboard.svelte";

    function create_fragment$a(ctx) {
    	let h1;
    	let t1;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let a;
    	let t7;
    	let dailyorders;
    	let current;
    	dailyorders = new DailyOrders({ $$inline: true });

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Dashboard";
    			t1 = space();
    			button0 = element("button");
    			button0.textContent = "Edit Tables";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Edit Menu";
    			t5 = space();
    			a = element("a");
    			a.textContent = "Log Out";
    			t7 = space();
    			create_component(dailyorders.$$.fragment);
    			add_location(h1, file$a, 4, 0, 70);
    			add_location(button0, file$a, 5, 0, 89);
    			add_location(button1, file$a, 6, 0, 118);
    			attr_dev(a, "href", "/admin/logout/");
    			add_location(a, file$a, 7, 0, 145);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, a, anchor);
    			insert_dev(target, t7, anchor);
    			mount_component(dailyorders, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dailyorders.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dailyorders.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(a);
    			if (detaching) detach_dev(t7);
    			destroy_component(dailyorders, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Dashboard> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Dashboard", $$slots, []);
    	$$self.$capture_state = () => ({ DailyOrders });
    	return [];
    }

    class Dashboard extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Dashboard",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.23.2 */
    const file$b = "src/App.svelte";

    // (12:0) {:else}
    function create_else_block$1(ctx) {
    	let signin;
    	let current;
    	signin = new CheckIn({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(signin.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(signin, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(signin.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(signin.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(signin, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(12:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (10:17) 
    function create_if_block_1$2(ctx) {
    	let menu;
    	let current;
    	menu = new Menu({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(menu.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(menu, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menu.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menu.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(menu, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(10:17) ",
    		ctx
    	});

    	return block;
    }

    // (8:0) {#if $user}
    function create_if_block$4(ctx) {
    	let dashboard;
    	let current;
    	dashboard = new Dashboard({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(dashboard.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(dashboard, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dashboard.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dashboard.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(dashboard, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(8:0) {#if $user}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let main;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block$4, create_if_block_1$2, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$user*/ ctx[0]) return 0;
    		if (/*$group*/ ctx[1]) return 1;
    		return 2;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if_block.c();
    			add_location(main, file$b, 6, 0, 209);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if_blocks[current_block_type_index].m(main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index !== previous_block_index) {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(main, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let $user;
    	let $group;
    	validate_store(user, "user");
    	component_subscribe($$self, user, $$value => $$invalidate(0, $user = $$value));
    	validate_store(group, "group");
    	component_subscribe($$self, group, $$value => $$invalidate(1, $group = $$value));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	$$self.$capture_state = () => ({
    		SignIn: CheckIn,
    		Menu,
    		Dashboard,
    		group,
    		user,
    		$user,
    		$group
    	});

    	return [$user, $group];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    const app = new App({
      target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
