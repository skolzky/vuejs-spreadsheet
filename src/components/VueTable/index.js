import VueThead from '../Thead/index.vue';
import VueTbody from '../Tbody/index.vue';

const Fuse = require('fuse.js');

export default {
  name: 'VueTable',
  props: {
    headers: {
      type: Array,
      required: true,
    },
    tbodyData: {
      type: Array,
      required: true,
    },
    customOptions: {
      type: Object,
      required: true,
    },
    styleWrapVueTable: {
      type: Object,
      required: true,
    },
    submenuThead: {
      type: Array,
      required: true,
    },
    disableSortThead: {
      type: Array,
      required: true,
    },
    loading: {
      type: Boolean,
      required: true,
    },
    selectPosition: {
      type: Object,
      required: true,
    },
    parentScrollElement: {
      type: Object,
      required: true,
    },
    disableCells: {
      type: Array,
      required: false,
    },
    submenuTbody: {
      type: Array,
      required: false,
    },
  },
  components: {
    VueThead,
    VueTbody,
  },
  data() {
    return {
      customTable: 0,
      changeDataIncrement: 0,
      disableKeyTimeout: null,
      eventDrag: false,
      headerTop: 0,
      highlight: {
        tbody: [],
        thead: [],
      },
      incrementCol: 0,
      incrementOption: null,
      incrementRow: null,
      keys: {},
      lastSelectOpen: null,
      lastSubmenuOpen: null,
      oldTdActive: null,
      oldTdShow: null,
      pressedShift: 0,
      rectangleSelectedCell: null,
      scrollDocument: null,
      scrollToSelectTimeout: null,
      selectedCell: null,
      selectedCoordCells: null,
      selectedCoordCopyCells: null,
      selectedMultipleCell: false,
      selectedMultipleCellActive: false,
      setFirstCell: false,
      storeCopyDatas: [],
      storeRectangleSelection: [],
      storeUndoData: [],
      submenuStatusTbody: false,
      submenuStatusThead: false,
    };
  },
  created() {
    this.customTable = Date.now();
  },
  mounted() {
    this.createdCell();
    window.addEventListener('keydown', this.moveKeydown);
    window.addEventListener('keyup', this.moveKeyup);
    document.addEventListener('copy', (event) => {
      if (this.actualElement) {
        event.preventDefault();
        this.storeCopyDatas = [];
        this.copyStoreData('copy');
      }
    });
    document.addEventListener('paste', (event) => {
      if (this.storeCopyDatas.length > 0) {
        event.preventDefault();
        this.pasteReplaceData();
      }
    });
    document.addEventListener('scroll', (event) => {
      this.scrollTopDocument(event);
    });
    // set property of triangle bg comment
    this.setPropertyStyleOfComment();
  },
  watch: {
    tbodyData() {
      this.createdCell();
    },
    headers() {
      this.createdCell();
    },
  },
  computed: {
    checkedRows() {
      return this.tbodyData.filter(x => x.checked);
    },
    colHeaderWidths() {
      return this.headers.map(x => parseInt(x.style.width, 10));
    },
    filteredList() {
      if (this.lastSelectOpen) {
        const { selectOptions } = this.lastSelectOpen.col;
        const { searchValue } = this.lastSelectOpen;
        const fuseSearch = new Fuse(selectOptions, this.customOptions.fuseOptions);
        if (searchValue && searchValue.length > 1) {
          return fuseSearch.search(searchValue);
        }
        return this.sorter(selectOptions);
      }
      return [];
    },
    headerKeys() {
      return this.headers.map(header => header.headerKey);
    },
  },
  methods: {
    checkedRow(row) {
      this.$emit('tbody-checked-row', row);
      this.$refs[`${this.customTable}-vueThead`].checkedAll = false;
    },
    highlightTdAndThead(rowIndex, colIndex) {
      this.highlight.tbody = [];
      this.highlight.thead = [];
      this.highlight.tbody = [...this.range(Math.min(this.selectedCell.row, rowIndex), Math.max(this.selectedCell.row, rowIndex))];
      this.highlight.thead = [...this.range(Math.min(this.selectedCell.col, colIndex), Math.max(this.selectedCell.col, colIndex))];
    },
    range(start, end) {
      return (new Array((end - start) + 1)).fill(undefined).map((_, i) => i + start);
    },
    setPropertyStyleOfComment() {
      if (this.styleWrapVueTable.comment && this.styleWrapVueTable.comment.borderColor) {
        this.$refs[`${this.customTable}-vueTable`].style.setProperty('--borderCommentColor', this.styleWrapVueTable.comment.borderColor);
      }
      if (this.styleWrapVueTable.comment && this.styleWrapVueTable.comment.borderSize) {
        this.$refs[`${this.customTable}-vueTable`].style.setProperty('--borderCommentSize', this.styleWrapVueTable.comment.borderSize);
      }
      if (this.styleWrapVueTable.comment && this.styleWrapVueTable.comment.widthBox) {
        this.$refs[`${this.customTable}-vueTable`].style.setProperty('--boxCommentWidth', this.styleWrapVueTable.comment.widthBox);
      }
      if (this.styleWrapVueTable.comment && this.styleWrapVueTable.comment.heightBox) {
        this.$refs[`${this.customTable}-vueTable`].style.setProperty('--BoxCommentHeight', this.styleWrapVueTable.comment.heightBox);
      }
    },
    changeData(rowIndex, header) {
      const cell = this.tbodyData[rowIndex][header];
      this.changeDataIncrement += 1;
      this.storeUndoData.push({ rowIndex, header, cell });
      this.$emit('tbody-change-data', rowIndex, header);
    },
    rollBackUndo() {
      if (this.storeUndoData.length && this.changeDataIncrement > 0) {
        const index = this.changeDataIncrement - 1;
        const store = this.storeUndoData[index];

        this.$emit('tbody-undo-data', store.rowIndex, store.header);
        this.tbodyData[store.rowIndex][store.header] = store.cell.duplicate;
        this.storeUndoData.splice(index, 1);
        this.changeDataIncrement -= 1;
      }
    },
    clearStoreUndo() {
      this.changeDataIncrement = 0;
      this.storeUndoData = [];
    },
    sorter(options) {
      return options.sort((a, b) => {
        const productA = a.value;
        const productB = b.value;
        if (productA === undefined && productB) return 1;
        if (productA && productB === undefined) return -1;
        if (productA < productB) return -1;
        if (productA > productB) return 1;
        return 0;
      });
    },
    cleanPropertyOnCell(action) {
      if (this.storeRectangleSelection.length > 0) {
        this.storeRectangleSelection.forEach((cell) => {
          if (action === 'paste' && !cell.classList.value.includes('rectangleSelection') && !cell.classList.value.includes('copy')) {
            this.cleanProperty(cell);
          } else if (action === 'copy' && !cell.classList.value.includes('selected')) {
            this.cleanProperty(cell);
          }
        });
      }
    },
    cleanProperty(element) {
      element.style.setProperty('--rectangleWidth', '100%');
      element.style.setProperty('--rectangleHeight', '40px');
      element.style.setProperty('--rectangleTop', 0);
      element.style.setProperty('--rectangleBottom', 0);
    },
    createdCell() {
      // create cell if isn't exist
      this.tbodyData.forEach((tbody, rowIndex) => {
        if (this.customOptions.tbodyCheckbox && !tbody.vuetable_checked) {
          this.$set(this.tbodyData[rowIndex], 'vuetable_checked', false);
        }
        this.headerKeys.forEach((header) => {
          if (!tbody[header]) {
            const data = JSON.parse(JSON.stringify(this.customOptions.newData));
            this.$set(this.tbodyData[rowIndex], header, data);
          } else if (!tbody[header].type && 'value' in tbody[header]) {
            const data = JSON.parse(JSON.stringify(this.customOptions.newData));
            const copyTbody = JSON.parse(JSON.stringify(tbody[header]));
            copyTbody.type = data.type;
            this.$set(this.tbodyData[rowIndex], header, copyTbody);
          }
          const copy = JSON.parse(JSON.stringify(this.tbodyData[rowIndex][header]));
          this.$set(this.tbodyData[rowIndex][header], 'duplicate', copy);
        });
      });
    },
    disabledEvent(col, header) {
      if (col.disabled === undefined) {
        return !this.disableCells.find(x => x === header);
      }
      if (col.disabled) {
        return !col.disabled;
      }
      return true;
    },
    scrollFunction(event) {
      this.affixHeader(event, 'vueTable');

      if (this.lastSelectOpen) {
        this.calculPosition(this.lastSelectOpen.event, this.lastSelectOpen.rowIndex, this.lastSelectOpen.colIndex, 'dropdown');
      } else if (this.lastSubmenuOpen) {
        this.calculPosition(this.lastSubmenuOpen.event, this.lastSubmenuOpen.rowIndex, this.lastSubmenuOpen.colIndex, 'contextMenu');
      }
    },
    scrollTopDocument(event) {
      this.affixHeader(event, 'document');

      if (this.lastSelectOpen) {
        this.calculPosition(event, this.lastSelectOpen.rowIndex, this.lastSelectOpen.colIndex, 'dropdown');
      } else if (this.lastSubmenuOpen) {
        this.calculPosition(event, this.lastSubmenuOpen.rowIndex, this.lastSubmenuOpen.colIndex, 'contextMenu');
      }
    },
    affixHeader(offset, target) {
      if (this.$refs && this.$refs[`${this.customTable}-table`] && this.$refs[`${this.customTable}-table`].offsetTop) {
        this.scrollDocument = document.querySelector(`${this.parentScrollElement.attribute}`).scrollTop;
        const offsetTopVueTable = this.$refs[`${this.customTable}-table`].offsetTop;
        const scrollOnDocument = this.scrollDocument || target === 'document';
        const offsetEl = scrollOnDocument ? this.scrollDocument : offset.target.scrollTop;

        if (offsetEl > offsetTopVueTable) {
          this.headerTop = scrollOnDocument ? (offsetEl - offsetTopVueTable) : (offsetEl - 18);
        } else {
          this.headerTop = 0;
        }
      }
    },
    updateSelectedCell(header, rowIndex, colIndex) {
      if (!this.setFirstCell) {
        this.$set(this.tbodyData[rowIndex][header], 'rectangleSelection', true);
        this.setFirstCell = true;
      }
      this.selectedCell = {
        header,
        row: rowIndex,
        col: colIndex,
      };
      // highlight selected row and column
      this.highlightTdAndThead(rowIndex, colIndex);
    },
    activeSelectSearch(event, rowIndex, colIndex) {
      this.calculPosition(event, rowIndex, colIndex, 'dropdown');
      if (this.$refs[`${this.customTable}-vueTbody`].$refs[`input-${this.customTable}-${colIndex}-${rowIndex}`][0]) {
        this.$refs[`${this.customTable}-vueTbody`].$refs[`input-${this.customTable}-${colIndex}-${rowIndex}`][0].focus();
      }
    },
    enableSelect(event, header, col, rowIndex, colIndex) {
      const currentElement = this.tbodyData[rowIndex][header];
      if (!col.search) {
        this.removeClass(['search', 'show']);
        this.lastSelectOpen = {
          col,
          colIndex,
          event,
          header,
          rowIndex,
        };

        this.$set(currentElement, 'search', true);
        this.$set(currentElement, 'show', true);

        this.$refs[`${this.customTable}-vueTbody`].$refs[`input-${this.customTable}-${colIndex}-${rowIndex}`][0].focus();
        this.calculPosition(event, rowIndex, colIndex, 'dropdown');

        if (currentElement.value !== '') {
          this.showDropdown(colIndex, rowIndex);
          const index = currentElement.selectOptions.map(x => x.value).indexOf(currentElement.value);
          this.incrementOption = index;
        } else {
          this.incrementOption = 0;
        }
      } else {
        this.$set(currentElement, 'search', false);
        this.$set(currentElement, 'show', false);
        this.lastSelectOpen = null;
      }
    },
    handleSearchInputSelect(event, searchValue, col, header, rowIndex, colIndex) {
      const disableSearch = !(searchValue === '' && event.keyCode === 8);

      if ((!this.keys.cmd || !this.keys.ctrl)
        && disableSearch
        && event.keyCode !== 13
        && event.keyCode !== 16
        && event.keyCode !== 17
        && event.keyCode !== 27
        && event.keyCode !== 37
        && event.keyCode !== 38
        && event.keyCode !== 39
        && event.keyCode !== 40
        && event.keyCode !== 91) {
        if (this.lastSelectOpen) {
          this.$set(this.lastSelectOpen, 'searchValue', searchValue);
        } else {
          this.lastSelectOpen = {
            event,
            header,
            col,
            rowIndex,
            colIndex,
            searchValue,
          };
        }

        // active class
        if (event.keyCode !== 8) {
          const currentData = this.tbodyData[rowIndex][header];
          this.$set(currentData, 'search', true);
          this.$set(currentData, 'show', true);

          this.showDropdown(colIndex, rowIndex);
        }
        this.incrementOption = 0;
      }
    },
    showDropdown(colIndex, rowIndex) {
      // clear timeout
      if (this.$refs[`${this.customTable}-vueTbody`].$refs[`dropdown-${this.customTable}-${colIndex}-${rowIndex}`]) {
        const dropdown = this.$refs[`${this.customTable}-vueTbody`].$refs[`dropdown-${this.customTable}-${colIndex}-${rowIndex}`][0];
        if (!this.scrollToSelectTimeout === null) {
          clearTimeout(this.scrollToSelectTimeout);
        }
        // set scrollTop on select
        this.scrollToSelectTimeout = setTimeout(() => {
          dropdown.scrollTop = 45 * this.incrementOption;
          this.scrollToSelectTimeout = null;
        }, 100);
      }
    },
    handleTbodySelectChange(event, header, col, option, rowIndex, colIndex) {
      const currentData = this.tbodyData[rowIndex][header];
      currentData.selectOptions.forEach((selectOption) => {
        const sOption = selectOption;
        sOption.active = false;
      });
      currentData.selectOptions.find(x => x.value === option.value).active = true;

      this.$set(currentData, 'search', false);
      this.$set(currentData, 'show', false);
      this.$set(currentData, 'value', option.value);

      this.lastSelectOpen = null;
      // remove class show on select when it change
      if (this.oldTdShow) this.tbodyData[this.oldTdShow.row][this.oldTdShow.key].show = false;
      this.enableSubmenu();
      // callback
      this.$emit('tbody-select-change', event, header, col, option, rowIndex, colIndex);
      this.changeData(rowIndex, header);
    },
    calculPosition(event, rowIndex, colIndex, header) {
      // stock scrollLeft / scrollTop position of parent
      const { scrollLeft } = this.$refs[`${this.customTable}-vueTable`];
      const { scrollTop } = this.$refs[`${this.customTable}-vueTable`];

      // get offsetTop of firstCell
      const firstCellOffsetTop = this.$refs[`${this.customTable}-vueTbody`].$refs[`td-${this.customTable}-0-0`][0].offsetTop;
      // stock $el
      const el = this.$refs[`${this.customTable}-vueTbody`].$refs[`td-${this.customTable}-${colIndex}-${rowIndex}`][0];
      // stock height Of VueTable
      const realHeightTable = this.$refs[`${this.customTable}-vueTable`].offsetHeight;
      // stock size / offsetTop / offsetLeft of the element
      const width = el.offsetWidth;
      // stock heightOfScrollbar(40) cell(40) dropdown(140)
      const heightOfScrollbarCellDropdown = 180;

      let top = ((el.offsetTop - scrollTop) + 40) - this.parentScrollElement.positionTop;
      let left = el.offsetLeft - scrollLeft;

      if (this.selectPosition) {
        top = (((el.offsetTop - scrollTop) + 40) + this.selectPosition.top) - this.parentScrollElement.positionTop;
        left = (el.offsetLeft - scrollLeft) + this.selectPosition.left;
      }

      // subtracted top of scroll top document
      if (this.scrollDocument) {
        top = (((el.offsetTop - scrollTop) + 40) - this.parentScrollElement.positionTop) - this.scrollDocument;
      }

      // set size / top position / left position
      const currentSelect = this.$refs[`${this.customTable}-vueTbody`].$refs[`${header}-${this.customTable}-${colIndex}-${rowIndex}`];
      if (currentSelect && currentSelect.length > 0) {
        currentSelect[0].style.setProperty('--selectWidth', `${width}px`);
        currentSelect[0].style.setProperty('--selectLeft', `${left}px`);

        if ((realHeightTable + firstCellOffsetTop) < (el.offsetTop + 250)) {
          currentSelect[0].style.setProperty('--selectTop', `${top - heightOfScrollbarCellDropdown}px`);
        } else {
          currentSelect[0].style.setProperty('--selectTop', `${top}px`);
        }
      }
    },
    setOldValueOnInputSelect(col, rowIndex, header, colIndex, type) {
      const column = col;
      column.show = false;
      this.$set(this.tbodyData[rowIndex][header], 'value', this.tbodyData[rowIndex][header].value);
      if (type === 'select') {
        column.search = false;
      }
    },
    handleUpDragSizeHeader(event, headers) {
      this.$emit('handle-up-drag-size-header', event, headers);
    },
    enableSubmenu(target) {
      if (target === 'thead') {
        this.submenuStatusThead = true;
        this.submenuStatusTbody = false;
      } else if (target === 'tbody') {
        this.submenuStatusThead = false;
        this.submenuStatusTbody = true;
      } else {
        this.submenuStatusThead = false;
        this.submenuStatusTbody = false;
      }
    },
    bindClassActiveOnTd(header, rowIndex, colIndex) {
      this.removeClass(['active', 'show']);
      this.tbodyData[rowIndex][header].active = true;
      // stock oldTdActive in object
      this.oldTdActive = {
        key: header,
        row: rowIndex,
        col: colIndex,
      };
    },
    removeClass(params) {
      if (params.includes('selected')) {
        this.selectedMultipleCellActive = false;
      }
      params.forEach((param) => {
        this.tbodyData.forEach((data, index) => {
          Object.keys(data).forEach((key) => {
            if (this.tbodyData[index] && this.tbodyData[index][key] && this.tbodyData[index][key][param] === true) {
              this.tbodyData[index][key][param] = false;
            }
          });
          if (param === 'rectangleSelection') {
            this.setFirstCell = false;
          }
        });
      });
    },
    // Copy / Paste
    copyStoreData(params) {
      const tbodyData = JSON.parse(JSON.stringify(this.tbodyData));
      this.removeClass(['stateCopy']);

      if (this.selectedCoordCells && this.selectedMultipleCell && params === 'copy') {
        if (this.selectedCell.row !== this.selectedCoordCells.rowEnd || this.selectedCell.col !== this.selectedCoordCells.colEnd) {
          this.selectedCell.row = this.selectedCoordCells.rowEnd;
          this.selectedCell.col = this.selectedCoordCells.colEnd;
        }
      }

      if (this.selectedCoordCells
        && this.selectedCell.col === this.selectedCoordCells.colEnd
        && this.selectedCell.row === this.selectedCoordCells.rowEnd
        && params === 'copy') {
        this.selectedCoordCopyCells = this.selectedCoordCells;
      } else {
        this.selectedCoordCopyCells = null;
      }

      if (this.selectedMultipleCell && this.selectedCoordCells) {
        let rowMin = Math.min(this.selectedCoordCells.rowStart, this.selectedCoordCells.rowEnd);
        const rowMax = Math.max(this.selectedCoordCells.rowStart, this.selectedCoordCells.rowEnd);
        let colMin = Math.min(this.selectedCoordCells.colStart, this.selectedCoordCells.colEnd);
        const colMax = Math.max(this.selectedCoordCells.colStart, this.selectedCoordCells.colEnd);
        const header = this.headerKeys[colMin];
        let storeData = {};

        if (params === 'copy') {
          this.$set(this.tbodyData[rowMin][header], 'stateCopy', true);
          this.removeClass(['rectangleSelection']);
          this.cleanPropertyOnCell('copy');
        }

        while (rowMin <= rowMax) {
          // remove stateCopy if present of storeData
          const copyData = tbodyData[rowMin][this.headerKeys[colMin]];
          copyData.active = false;
          copyData.selected = false;
          copyData.stateCopy = false;

          storeData[this.headerKeys[colMin]] = copyData;
          colMin += 1;
          if (colMin > colMax) {
            this.storeCopyDatas.push(storeData);
            colMin = Math.min(this.selectedCoordCells.colStart, this.selectedCoordCells.colEnd);
            rowMin += 1;
            storeData = {};
          }
        }
        this.copyMultipleCell = true;
      } else {
        if (params === 'copy') {
          this.cleanPropertyOnCell('copy');
          this.$set(this.tbodyData[this.selectedCell.row][this.selectedCell.header], 'stateCopy', true);
        } else {
          this.storeCopyDatas = [];
        }
        // remove stateCopy if present of storeData
        const copyData = tbodyData[this.selectedCell.row][this.selectedCell.header];
        copyData.active = false;
        copyData.selected = false;
        copyData.stateCopy = false;
        this.storeCopyDatas.push(copyData);
        this.copyMultipleCell = false;
      }
    },
    pasteReplaceData() {
      const maxRow = this.tbodyData.length;
      this.cleanPropertyOnCell('paste');

      // copy / paste one cell || disable on disabled cell
      if (this.storeCopyDatas[0].value && !this.copyMultipleCell && !this.selectedMultipleCell && !this.eventDrag && this.disabledEvent(this.selectedCell.col, this.selectedCell.header)) {
        const { duplicate } = this.tbodyData[this.selectedCell.row][this.selectedCell.header];
        this.storeCopyDatas[0].duplicate = duplicate;
        this.storeCopyDatas[0].active = true;

        // create newCopyData
        const newCopyData = JSON.parse(JSON.stringify(this.storeCopyDatas));
        [this.tbodyData[this.selectedCell.row][this.selectedCell.header]] = newCopyData;

        // callback changeData
        this.changeData(this.selectedCell.row, this.selectedCell.header);
        // disable on disabled cell
      } else if (this.disabledEvent(this.selectedCell.col, this.selectedCell.header) && this.selectedCoordCells) {
        // if paste in multiple selection
        const conditionPasteToMultipleSelection = this.selectedCoordCopyCells !== null && this.selectedCoordCells !== this.selectedCoordCopyCells;

        // new paste data
        const conditionRowToMultiplePasteRow = this.storeCopyDatas.length === 1
          && !this.storeCopyDatas[0].type
          && this.selectedCoordCopyCells !== null
          && Object.values(this.storeCopyDatas[0]).length > 1
          && this.selectedCoordCells.rowStart < this.selectedCoordCells.rowEnd;

        // copy / paste multiple cell | drag to fill one / multiple cell
        let rowMin = Math.min(this.selectedCoordCells.rowStart, this.selectedCoordCells.rowEnd);
        let rowMax = Math.max(this.selectedCoordCells.rowStart, this.selectedCoordCells.rowEnd);
        let colMin = Math.min(this.selectedCoordCells.colStart, this.selectedCoordCells.colEnd);
        let colMax = Math.max(this.selectedCoordCells.colStart, this.selectedCoordCells.colEnd);

        if (conditionPasteToMultipleSelection) {
          rowMin = Math.min(this.selectedCoordCopyCells.rowStart, this.selectedCoordCopyCells.rowEnd);
          rowMax = Math.max(this.selectedCoordCopyCells.rowStart, this.selectedCoordCopyCells.rowEnd);
        }

        if (conditionRowToMultiplePasteRow) {
          rowMin = Math.min(this.selectedCoordCells.rowStart, this.selectedCoordCells.rowEnd);
          rowMax = Math.max(this.selectedCoordCells.rowStart, this.selectedCoordCells.rowEnd);
        }

        if (conditionPasteToMultipleSelection || conditionRowToMultiplePasteRow) {
          colMin = Math.min(this.selectedCoordCopyCells.colStart, this.selectedCoordCopyCells.colEnd);
          colMax = Math.max(this.selectedCoordCopyCells.colStart, this.selectedCoordCopyCells.colEnd);
        }

        let row = 0;
        let col = 0;

        while (rowMin <= rowMax) {
          const header = this.headerKeys[colMin];
          const newCopyData = JSON.parse(JSON.stringify(this.storeCopyDatas));

          if (this.eventDrag) { // Drag To Fill
            const { duplicate } = this.tbodyData[rowMin][header];
            if (newCopyData[0][header]) {
              newCopyData[0][header].duplicate = duplicate;
              this.tbodyData[rowMin][header] = newCopyData[0][header]; // multiple cell
            } else {
              newCopyData[0].duplicate = duplicate;
              [this.tbodyData[rowMin][header]] = newCopyData; // one cell
            }
            this.changeData(rowMin, header);
          } else {
            let incrementRow = this.selectedCell.row + row;
            let incrementCol = this.selectedCell.col + col;

            if (this.selectedCoordCells !== this.selectedCoordCopyCells) {
              incrementRow = this.selectedCoordCells.rowStart + row;
              incrementCol = this.selectedCoordCells.colStart + col;
            }

            let currentHeader = this.headerKeys[incrementCol];

            // multiple col to multiple col
            const colsToCols = Object.values(newCopyData[0]).length === 1;
            if (colsToCols) {
              currentHeader = this.headerKeys[this.selectedCell.col];
              if (incrementRow < maxRow) {
                this.replacePasteData(col, header, incrementRow, currentHeader);
                col += 1;
              }
            }

            // one cell to multipleCell
            const cellToCells = newCopyData.length === 1 && Object.values(newCopyData).length === 1 && newCopyData[0].type;
            if (cellToCells) {
              currentHeader = this.selectedCell.header;
              newCopyData[0].duplicate = this.tbodyData[rowMin][currentHeader].duplicate;
              [this.tbodyData[rowMin][currentHeader]] = newCopyData;
              this.changeData(rowMin, currentHeader);
            }

            // 1 row to 1 row
            const rowToRow = newCopyData.length === 1 && Object.values(newCopyData[0]).length > 1 && !newCopyData[0].type && this.selectedCoordCells.rowStart === this.selectedCoordCells.rowEnd;
            if (rowToRow) {
              this.replacePasteData(0, header, this.selectedCell.row, currentHeader);
              col += 1;
            }

            // 1 row & multiple cols => to multiple row & cols
            const rowColsToRowsCols = newCopyData.length === 1
              && Object.values(newCopyData[0]).length > 1
              && this.selectedCoordCells.rowStart < this.selectedCoordCells.rowEnd
              && this.selectedCoordCells.colStart !== this.selectedCoordCells.colEnd;
            if (rowColsToRowsCols) {
              this.replacePasteData(0, header, incrementRow, currentHeader);
              if (colMin < colMax) {
                col += 1;
              } else {
                col = 0;
              }
            }

            // multiple col / row to multiple col / row
            const rowsColsToRowsCols = newCopyData.length > 1 && Object.values(newCopyData[0]).length > 1;
            if (rowsColsToRowsCols) {
              if (this.tbodyData[incrementRow][currentHeader]) {
                newCopyData[row][header].duplicate = this.tbodyData[incrementRow][currentHeader].duplicate;
              }
              this.replacePasteData(row, header, incrementRow, currentHeader);
              if (colMin < colMax) {
                col += 1;
              } else {
                col = 0;
              }
            }

            // add active / selected status on firstCell
            this.tbodyData[this.selectedCell.row][this.selectedCell.header].selected = true;
            this.tbodyData[this.selectedCell.row][this.selectedCell.header].active = true;
          }
          colMin += 1;
          if (colMin > colMax) {
            if (this.selectedCoordCopyCells !== null && this.selectedCoordCells !== this.selectedCoordCopyCells) {
              colMin = Math.min(this.selectedCoordCopyCells.colStart, this.selectedCoordCopyCells.colEnd);
            } else {
              colMin = Math.min(this.selectedCoordCells.colStart, this.selectedCoordCells.colEnd);
            }
            rowMin += 1;
            row += 1;
          }
        }
        this.modifyMultipleCell();
      }
    },
    replacePasteData(col, header, incrementRow, currentHeader) {
      const newCopyData = JSON.parse(JSON.stringify(this.storeCopyDatas));
      newCopyData[col][header].duplicate = this.tbodyData[incrementRow][currentHeader].duplicate;
      this.tbodyData[incrementRow][currentHeader] = newCopyData[col][header];
      this.changeData(incrementRow, currentHeader);
    },
    modifyMultipleCell(params) {
      let rowMin = Math.min(this.selectedCoordCells.rowStart, this.selectedCoordCells.rowEnd);
      const rowMax = Math.max(this.selectedCoordCells.rowStart, this.selectedCoordCells.rowEnd);
      let colMin = Math.min(this.selectedCoordCells.colStart, this.selectedCoordCells.colEnd);
      const colMax = Math.max(this.selectedCoordCells.colStart, this.selectedCoordCells.colEnd);

      while (rowMin <= rowMax) {
        const header = this.headerKeys[colMin];
        // disable on disabled cell
        if (params === 'removeValue' && this.disabledEvent(this.tbodyData[rowMin][header], header)) {
          this.$emit('tbody-nav-backspace', rowMin, colMin, header, this.tbodyData[rowMin][header]);
          this.changeData(rowMin, header);
          this.$set(this.tbodyData[rowMin][header], 'value', '');
          this.$set(this.tbodyData[rowMin][header], 'selected', false);
        }
        if (params === 'selected') {
          this.$set(this.tbodyData[rowMin][header], 'selected', true);
          this.selectedMultipleCellActive = true;
          if (colMin === colMax && rowMin === rowMax) {
            // add active on the last cell
            this.removeClass(['active']);
            this.$set(this.tbodyData[rowMin][header], 'active', true);
          }
        }
        colMin += 1;
        if (colMin > colMax) {
          colMin = Math.min(this.selectedCoordCells.colStart, this.selectedCoordCells.colEnd);
          rowMin += 1;
        }
      }

      // Set height / width of rectangle
      this.setRectangleSelection(colMin, colMax, rowMin, rowMax);
    },
    setRectangleSelection(colMin, colMax, rowMin, rowMax) {
      let width = 100;
      let height = 40;

      // Defined width of rectangle
      if (colMin === 0 && colMax === 0) {
        width = 100 * (colMin + 1);
      } else if (colMin === 0 && colMax > 0) {
        width = 100 * (colMax + 1);
      } else {
        width = 100 * ((colMax - colMin) + 1);
      }

      // Defined height of rectangle
      if ((rowMin === 0 && rowMax === 0) || (rowMin === 0 && rowMax > 0)) {
        height = 40 * (rowMin + 1);
      } else if (this.selectedCoordCells.rowEnd > this.selectedCoordCells.rowStart) {
        height = 40 * ((this.selectedCoordCells.rowEnd - this.selectedCoordCells.rowStart) + 1);
      } else {
        height = 40 * ((this.selectedCoordCells.rowStart - this.selectedCoordCells.rowEnd) + 1);
      }

      if (this.$refs[`${this.customTable}-vueTbody`] && this.$refs[`${this.customTable}-vueTbody`].$refs) {
        [this.rectangleSelectedCell] = this.$refs[`${this.customTable}-vueTbody`].$refs[`td-${this.customTable}-${this.selectedCoordCells.colStart}-${this.selectedCoordCells.rowStart}`];

        if (!this.selectedMultipleCellActive) {
          [this.rectangleSelectedCell] = this.$refs[`${this.customTable}-vueTbody`].$refs[`td-${this.customTable}-${this.selectedCell.col}-${this.selectedCell.row}`];
        }
      }

      this.rectangleSelectedCell.style.setProperty('--rectangleWidth', `${width + 1}%`);
      this.rectangleSelectedCell.style.setProperty('--rectangleHeight', `${height}px`);

      // Position bottom/top of rectangle if rowStart >= rowEnd
      if (this.selectedCoordCells.rowStart >= this.selectedCoordCells.rowEnd) {
        this.rectangleSelectedCell.style.setProperty('--rectangleTop', 'auto');
        this.rectangleSelectedCell.style.setProperty('--rectangleBottom', 0);
      } else {
        this.rectangleSelectedCell.style.setProperty('--rectangleTop', 0);
        this.rectangleSelectedCell.style.setProperty('--rectangleBottom', 'auto');
      }
      // Position left/right of rectangle if colStart >= colEnd
      if (this.selectedCoordCells.colStart >= this.selectedCoordCells.colEnd) {
        this.rectangleSelectedCell.style.setProperty('--rectangleLeft', 'auto');
        this.rectangleSelectedCell.style.setProperty('--rectangleRight', 0);
      } else {
        this.rectangleSelectedCell.style.setProperty('--rectangleLeft', 0);
      }

      if (!this.storeRectangleSelection.includes(this.rectangleSelectedCell)) {
        this.storeRectangleSelection.push(this.rectangleSelectedCell);
      }
    },
    // drag To Fill
    handleDownDragToFill(event, header, col, rowIndex) {
      this.storeCopyDatas = [];
      this.$set(this.tbodyData[rowIndex][header], 'active', true);
      this.eventDrag = true;
      if (!this.selectedCoordCells && !this.selectedMultipleCell) {
        this.selectedCoordCells = {
          rowStart: this.selectedCell.row,
          colStart: this.selectedCell.col,
          keyStart: this.selectedCell.header,
          rowEnd: rowIndex,
          colEnd: this.selectedCell.col,
          keyEnd: this.selectedCell.header,
        };
      } else if (this.selectedMultipleCell) {
        // if drag col to col in row to row to row
        this.selectedCoordCells.rowStart = rowIndex;
      } else {
        this.selectedCoordCells = {
          rowStart: this.selectedCell.row,
          colStart: this.selectedCell.col,
          keyStart: this.selectedCell.header,
          rowEnd: rowIndex,
          colEnd: this.selectedCell.col,
          keyEnd: this.selectedCell.header,
        };
      }
      this.copyStoreData('drag');
    },
    handleMoveDragToFill(event, header, col, rowIndex, colIndex) {
      if (this.eventDrag === true && this.selectedCoordCells && this.selectedCoordCells.rowEnd !== rowIndex) {
        this.selectedCoordCells.rowEnd = rowIndex;
        this.modifyMultipleCell('selected');
        this.$emit('tbody-move-dragtofill', this.selectedCoordCells, header, col, rowIndex, colIndex);
      }
    },
    handleUpDragToFill(event, header, rowIndex, colIndex) {
      if (this.eventDrag === true && this.selectedCoordCells) {
        this.selectedCoordCells.rowEnd = rowIndex;
        this.pasteReplaceData();
        this.removeClass(['selected', 'rectangleSelection', 'active', 'show']);
        this.$emit('tbody-up-dragtofill', this.selectedCoordCells, header, rowIndex, colIndex);
        this.eventDrag = false;
        this.storeCopyDatas = [];
        this.selectedCoordCells = null;
      }
    },
    // On click on td
    handleTbodyTdClick(event, col, header, rowIndex, colIndex, type) {
      const column = col;

      if (this.selectedMultipleCell) {
        this.selectedMultipleCell = false;
      }

      if (!column.active) {
        if (!this.keys[16]) {
          this.removeClass(['selected', 'rectangleSelection']);
        }
        this.removeClass(['search']);
        this.lastSelectOpen = null;
      }
      this.bindClassActiveOnTd(header, rowIndex, colIndex);

      this.updateSelectedCell(header, rowIndex, colIndex);

      this.enableSubmenu();
      if (this.oldTdShow && this.oldTdShow.col !== colIndex) {
        this.tbodyData[this.oldTdShow.row][this.oldTdShow.key].show = false;
      }

      if (type === 'select' && column.handleSearch) {
        this.activeSelectSearch(event, rowIndex, colIndex, header);
      }
    },
    handleSelectMultipleCell(event, header, rowIndex, colIndex) {
      if (!this.selectedMultipleCellActive) {
        this.selectedMultipleCell = true;
        if (this.selectedCell) {
          this.selectedCoordCells = {
            rowStart: this.selectedCell.row,
            colStart: this.selectedCell.col,
            keyStart: this.selectedCell.header,
            rowEnd: rowIndex,
            colEnd: colIndex,
            keyEnd: header,
          };
        }
        // Add active on selectedCoordCells selected
        this.modifyMultipleCell('selected');

        // highlight row and column of selected cell
        this.highlightTdAndThead(rowIndex, colIndex);
      }
    },
    handleTbodyTdDoubleClick(event, header, col, rowIndex, colIndex) {
      // stock oldTdShow in object
      if (this.oldTdShow) this.tbodyData[this.oldTdShow.row][this.oldTdShow.key].show = false;

      // add class show on element
      this.$set(this.tbodyData[rowIndex][header], 'show', true);
      event.currentTarget.lastElementChild.focus();

      this.oldTdShow = {
        key: header,
        row: rowIndex,
        col: colIndex,
      };

      this.enableSubmenu();
    },
    handleTbodyNav() {
      this.enableSubmenu();
    },
    handleTbodyNavEnter() {
      this.enableSubmenu();
    },
    handleTbodyNavBackspace(rowIndex, colIndex, header) {
      if (this.selectedMultipleCell) {
        this.modifyMultipleCell('removeValue');
      } else {
        this.$emit('tbody-nav-backspace', rowIndex, colIndex, header, this.tbodyData[rowIndex][header]);
        this.changeData(rowIndex, header);
        this.tbodyData[rowIndex][header].value = '';
      }
    },
    handleTbodyInputChange(event, header, rowIndex, colIndex) {
      // remove class show on input when it change
      if (this.oldTdShow) this.tbodyData[this.oldTdShow.row][this.oldTdShow.key].show = false;
      this.enableSubmenu();

      // callback
      this.$emit('tbody-input-change', event, header, rowIndex, colIndex);
      this.changeData(rowIndex, header);
    },
    // callback
    callbackCheckedAll(isChecked) {
      this.$emit('tbody-all-checked-row', isChecked);
      if (this.customOptions.tbodyCheckbox) {
        this.tbodyData.forEach((data) => {
          this.$set(data, 'vuetable_checked', isChecked);
        });
      }
    },
    callbackSort(event, header, colIndex) {
      this.$emit('thead-td-sort', event, header, colIndex);
    },
    callbackSubmenuThead(event, header, colIndex, submenuFunction, selectOptions) {
      this.submenuStatusThead = false;
      if (selectOptions) {
        this.$emit(`thead-submenu-click-${submenuFunction}`, event, header, colIndex, selectOptions);
      } else {
        this.$emit(`thead-submenu-click-${submenuFunction}`, event, header, colIndex);
      }
    },
    callbackSubmenuTbody(event, header, rowIndex, colIndex, type, submenuFunction) {
      this.calculPosition(event, rowIndex, colIndex, 'submenu');
      this.$emit(`tbody-submenu-click-${submenuFunction}`, event, header, rowIndex, colIndex, type, submenuFunction);
    },
    handleTBodyContextMenu(event, header, rowIndex, colIndex) {
      this.lastSubmenuOpen = {
        event,
        header,
        rowIndex,
        colIndex,
      };
    },
    // thead
    handleTheadContextMenu() {
      this.submenuStatusTbody = false;
    },
    moveOnSelect(event) {
      if (this.incrementOption <= this.filteredList.length) {
        // top
        const dropdown = this.$refs[`${this.customTable}-vueTbody`].$refs[`dropdown-${this.customTable}-${this.lastSelectOpen.colIndex}-${this.lastSelectOpen.rowIndex}`][0];
        if (event.keyCode === 38) {
          if (this.incrementOption <= this.filteredList.length && this.incrementOption > 0) {
            if (this.filteredList[this.incrementOption]) {
              this.$set(this.filteredList[this.incrementOption], 'active', false);
              this.incrementOption -= 1;
              this.$set(this.filteredList[this.incrementOption], 'active', true);
            } else {
              this.incrementOption -= 1;
              this.$set(this.filteredList[this.incrementOption], 'active', false);
              this.incrementOption -= 1;
              this.$set(this.filteredList[this.incrementOption], 'active', true);
            }
            if (this.incrementOption % 3 === 0) {
              dropdown.scrollTop -= (45 * 3);
            }
          }
        }
        // bottom
        if (event.keyCode === 40) {
          if (this.incrementOption < this.filteredList.length - 1) {
            if (this.incrementOption === 0 || this.incrementOption === 1) {
              this.$set(this.filteredList[this.incrementOption], 'active', true);
              this.incrementOption += 1;
              this.$set(this.filteredList[this.incrementOption], 'active', true);
              this.$set(this.filteredList[this.incrementOption - 1], 'active', false);
            } else if (this.incrementOption > 1) {
              this.$set(this.filteredList[this.incrementOption], 'active', false);
              this.incrementOption += 1;
              this.$set(this.filteredList[this.incrementOption], 'active', true);
            }
          }
          if (this.incrementOption % 3 === 0) {
            dropdown.scrollTop = 45 * this.incrementOption;
          }
        }
      }
      // enter
      if (event.keyCode === 13) {
        const oldSelect = this.lastSelectOpen;
        const currentSelect = this.tbodyData[oldSelect.rowIndex][oldSelect.header];
        this.handleTbodySelectChange(event, oldSelect.header, currentSelect, this.filteredList[this.incrementOption], oldSelect.rowIndex, oldSelect.colIndex);
      }
    },
    moveOnTable(event, colIndex, rowIndex) {
      const vueTable = this.$refs[`${this.customTable}-vueTable`];

      const maxCol = Math.max(...this.colHeaderWidths);
      // get the correct height of visible table
      if (vueTable) {
        const heightTable = vueTable.clientHeight - vueTable.firstElementChild.clientHeight - this.$refs[`${this.customTable}-vueThead`].$el.clientHeight;
        const widthTable = vueTable.clientWidth - 40;
        const borderBottomCell = Math.round(heightTable / 40);
        const borderRightCell = Math.round(widthTable / maxCol);
        // top
        if (event.keyCode === 38) {
          event.preventDefault();
          if (borderBottomCell >= rowIndex) {
            vueTable.scrollTop -= 40;
          }
        }
        // bottom
        if (event.keyCode === 40) {
          event.preventDefault();
          if ((borderBottomCell - 1) <= rowIndex) {
            vueTable.scrollTop += 40;
          }
        }
        // left
        if (event.keyCode === 37) {
          event.preventDefault();
          if ((borderRightCell + 1) >= colIndex) {
            vueTable.scrollLeft -= maxCol;
          }
        }
        // right
        if (event.keyCode === 39) {
          event.preventDefault();
          if ((borderRightCell - 1) <= colIndex) {
            vueTable.scrollLeft += maxCol;
          }
        }
      }
    },
    pressShiftMultipleCell(event, h, rowMax, rowIndex, colMax, colIndex) {
      event.preventDefault();
      let header = h;
      this.$set(this.tbodyData[rowIndex][header], 'active', false);
      this.incrementCol = this.incrementCol ? this.incrementCol : colIndex;
      this.incrementRow = this.incrementRow ? this.incrementRow : rowIndex;
      if (this.pressedShift >= 0) {
        this.pressedShift += 1;
      }
      if (this.pressedShift === 0) {
        this.selectedCell = {
          header,
          row: rowIndex,
          col: colIndex,
        };
      }

      // shift / left
      if (event.keyCode === 37) {
        this.incrementCol -= 1;
        if (this.incrementCol < 0) {
          this.incrementCol = 0;
        }
        this.removeClass(['selected']);
      }
      // shift / top
      if (event.keyCode === 38) {
        this.incrementRow -= 1;
        if (this.incrementRow < 0) {
          this.incrementRow = 0;
        }
        this.removeClass(['selected']);
      }
      // shift / right
      if (event.keyCode === 39) {
        if (colMax >= this.incrementCol + 2) {
          this.incrementCol += 1;
        } else {
          this.$set(this.tbodyData[rowIndex][header], 'active', true);
        }
      }
      // shift / bottom
      if (event.keyCode === 40) {
        if (rowMax >= this.incrementRow + 2) {
          this.incrementRow += 1;
        } else {
          this.$set(this.tbodyData[rowIndex][header], 'active', true);
        }
      }
      header = Object.values(this.headerKeys)[this.incrementCol];
      this.$set(this.tbodyData[this.incrementRow][header], 'active', true);
      this.handleSelectMultipleCell(event, header, this.incrementRow, this.incrementCol);
    },
    moveKeyup(event) {
      if (event.keyCode === 16) {
        this.keys[event.keyCode] = false;
        this.incrementCol = null;
        this.incrementRow = null;
        this.selectedMultipleCell = true;
        this.pressedShift = 0;
      }

      if (event.keyCode === 91 || event.keyCode === 17) {
        if (!this.disableKeyTimeout === null) {
          clearTimeout(this.disableKeyTimeout);
        }
        this.disableKeyTimeout = setTimeout(() => {
          this.keys.cmd = false;
          this.keys.ctrl = false;
          this.disableKeyTimeout = null;
        }, 400);
      }
    },
    moveKeydown(event) {
      [this.actualElement] = document.getElementsByClassName('active_td');

      if (event.keyCode === 16) {
        this.keys[event.keyCode] = true;
      }

      if (event.keyCode === 91 || event.keyCode === 17) {
        this.keys.cmd = true;
        this.keys.ctrl = true;
      }

      if ((this.keys.cmd && event.keyCode === 90) || (this.keys.ctrl && event.keyCode === 90)) {
        this.rollBackUndo();
      }

      if (this.lastSelectOpen) {
        this.moveOnSelect(event);
      }

      if (this.actualElement
        && this.actualElement.getAttribute('current-table') === this.customTable.toString()
        && (event.keyCode === 37
        || event.keyCode === 39
        || event.keyCode === 40
        || event.keyCode === 38
        || event.keyCode === 13
        || event.keyCode === 27
        || event.keyCode === 8)) {
        this.removeClass(['selected']);

        const colIndex = Number(this.actualElement.getAttribute('data-col-index'));
        const rowIndex = Number(this.actualElement.getAttribute('data-row-index'));
        const dataType = this.actualElement.getAttribute('data-type');
        const header = this.actualElement.getAttribute('data-header');

        if (!this.setFirstCell) {
          this.$set(this.tbodyData[rowIndex][header], 'rectangleSelection', true);
          this.setFirstCell = true;
        }

        // set colMax rowMax
        const rowMax = this.tbodyData.length;
        const colMax = this.headers.length;

        this.moveOnTable(event, colIndex, rowIndex);

        // shift
        if (this.keys[16]) {
          this.pressShiftMultipleCell(event, header, rowMax, rowIndex, colMax, colIndex);
        } else if (!this.lastSelectOpen && event.keyCode !== 8) {
          if (this.selectedMultipleCell) {
            this.selectedMultipleCell = false;
          }
          this.$set(this.tbodyData[rowIndex][header], 'active', false);
          this.removeClass(['rectangleSelection']);
          // left
          if (event.keyCode === 37) {
            const decrementHeader = Object.values(this.headerKeys)[colIndex - 1];
            if (decrementHeader) {
              this.$set(this.tbodyData[rowIndex][decrementHeader], 'active', true);
              if (dataType === 'select') { this.activeSelectSearch(event, rowIndex, colIndex, decrementHeader); }
              this.updateSelectedCell(decrementHeader, rowIndex, colIndex - 1);
            } else {
              this.$set(this.tbodyData[rowIndex][header], 'active', true);
              if (dataType === 'select') { this.activeSelectSearch(event, rowIndex, colIndex, header); }
              this.updateSelectedCell(header, rowIndex, colIndex);
            }
          }
          // top
          if (event.keyCode === 38) {
            if (rowIndex !== 0) {
              this.$set(this.tbodyData[rowIndex - 1][header], 'active', true);
              if (dataType === 'select') { this.activeSelectSearch(event, rowIndex - 1, colIndex, header); }
              this.updateSelectedCell(header, rowIndex - 1, colIndex);
            } else {
              this.$set(this.tbodyData[rowIndex][header], 'active', true);
              if (dataType === 'select') { this.activeSelectSearch(event, rowIndex, colIndex, header); }
              this.updateSelectedCell(header, rowIndex, colIndex);
            }
          }
          // right
          if (event.keyCode === 39) {
            const incrementHeader = Object.values(this.headerKeys)[colIndex + 1];
            if (incrementHeader) {
              this.$set(this.tbodyData[rowIndex][incrementHeader], 'active', true);
              if (dataType === 'select') { this.activeSelectSearch(event, rowIndex, colIndex, incrementHeader); }
              this.updateSelectedCell(incrementHeader, rowIndex, colIndex + 1);
            } else {
              this.$set(this.tbodyData[rowIndex][header], 'active', true);
              if (dataType === 'select') { this.activeSelectSearch(event, rowIndex, colIndex, header); }
              this.updateSelectedCell(header, rowIndex, colIndex);
            }
          }
          // bottom
          if (event.keyCode === 40) {
            if (rowIndex + 1 !== rowMax) {
              this.$set(this.tbodyData[rowIndex + 1][header], 'active', true);
              if (dataType === 'select') { this.activeSelectSearch(event, rowIndex + 1, colIndex, header); }
              this.updateSelectedCell(header, rowIndex + 1, colIndex);
            } else {
              this.$set(this.tbodyData[rowIndex][header], 'active', true);
              if (dataType === 'select') { this.activeSelectSearch(event, rowIndex, colIndex, header); }
              this.updateSelectedCell(header, rowIndex, colIndex);
            }
          }
        }
        // press backspace
        if (event.keyCode === 8 && !this.lastSelectOpen) {
          this.handleTbodyNavBackspace(rowIndex, colIndex, header);
        }
        // press enter
        if (event.keyCode === 13) {
          if (this.$refs[`input-${this.customTable}-${colIndex}-${rowIndex}`]) {
            this.tbodyData[rowIndex][header].show = true;
            this.$refs[`input-${this.customTable}-${colIndex}-${rowIndex}`][0].focus();
          }
          this.$emit('tbody-nav-enter', event, event.keyCode, this.actualElement, rowIndex, colIndex);
        }
        // press esc
        if (event.keyCode === 27) {
          this.tbodyData[rowIndex][header].active = false;
          this.storeCopyDatas = [];
          this.removeClass(['stateCopy']);
        }
      }
    },
  },
};