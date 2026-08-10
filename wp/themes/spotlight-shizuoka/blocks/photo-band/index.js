/**
 * spotlight/photo-band の編集画面。
 *
 * メディアライブラリから複数選んで並べるだけ。表示は render.php が組む。
 * 2枚以上で流れる帯になり、1枚なら本文に回り込む単独写真として出る。
 */
(function (blocks, blockEditor, element, components) {
  'use strict';

  var e = element.createElement;

  blocks.registerBlockType('spotlight/photo-band', {
    edit: function (props) {
      var ids = props.attributes.ids || [];

      return e(
        'div',
        blockEditor.useBlockProps({ className: 'spot-band' }),
        e(
          blockEditor.MediaUploadCheck,
          null,
          e(blockEditor.MediaUpload, {
            multiple: true,
            gallery: true,
            allowedTypes: ['image'],
            value: ids,
            onSelect: function (items) {
              props.setAttributes({
                ids: items.map(function (item) { return item.id; })
              });
            },
            render: function (open) {
              return e(
                components.Button,
                { variant: 'secondary', onClick: open.open },
                ids.length ? '写真を選び直す（' + ids.length + '枚）' : '写真を選ぶ'
              );
            }
          })
        ),
        ids.length
          ? e(
              'p',
              { className: 'spot-band__note' },
              ids.length === 1
                ? '1枚なので、本文に回り込む写真として出ます'
                : ids.length + '枚を横に並べて流します'
            )
          : null
      );
    },

    save: function () { return null; }
  });
})(window.wp.blocks, window.wp.blockEditor, window.wp.element, window.wp.components);
