import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { AppStateService } from '../app-state.service';
import { FiniteAutomata } from './finite-automata';
import { Subscription } from 'rxjs/Subscription';
import { ToolEvent } from '../toolbar.component';
import { Router } from '@angular/router';
import { Metadata } from '../project';

declare var alertify;

@Component({
  templateUrl: './finite.component.html'
})
export class FiniteComponent implements OnInit, OnDestroy {
  private subscription: Subscription;
  automata: FiniteAutomata;

  constructor(private appStateService: AppStateService,
              private router: Router) {}

  @HostListener('document:keydown', ['$event']) onKeyUp($event: KeyboardEvent) { 
    let keyCode = $event.code;
    
    if($event.ctrlKey) {
      $event.preventDefault();
      $event.stopPropagation();
      switch(keyCode) {
        case "KeyZ":
        this.appStateService.undoAction();
          break;
        case "KeyY":        
          this.appStateService.redoAction();
          break;
        case "KeyO":
          this.openFile();
          break;
        case "KeyN":
          this.newFSM();
          break;
        case "KeyS":
          this.saveFSM();
          break;
      } 
    } else {
      switch(keyCode) {
        case "Escape":
          this.automata.selectedState = null;
          this.automata.selectedTransition = null;
          break;
      }
      
    }
  }
    
  
  ngOnInit() {
    if(this.appStateService.hasActiveProject) {
      this.automata = this.appStateService.project as FiniteAutomata;
      if(this.automata.type != "finite-automata") { // This should never happen
        this.router.navigateByUrl("/home", { replaceUrl: true });
      }
    } else {
      this.newFSM();     
    }

    this.subscription = this.appStateService.toolbarClickedStream.subscribe(($event) => {
      this.onToolClicked($event);
    });
  }

  ngOnDestroy() {
    this.appStateService.closeActiveProject();
    this.subscription.unsubscribe();
  }

  onToolClicked($event: ToolEvent) {
    switch($event.target) {
      case "new":
        this.newFSM();
        break;
      case "open":
        this.openFile();
        break;
      case "save":
        this.saveFSM();
        break;
      case "undo":
        this.appStateService.undoAction();
        break;
      case "redo": 
        this.appStateService.redoAction(); 
        break;
    }
  }

  openFile() {
    this.protectAgainstUnsavedChanges(() => {
      let fileInput = document.createElement('input');
      fileInput.style.display='none';
      fileInput.type='file';
      fileInput.setAttribute("accept", ".fsm.json");
      document.body.appendChild(fileInput);  
      fileInput.addEventListener("change", ($event) => {
        if(fileInput.files.length > 0) {
          this.loadFSM(fileInput.files[0]);
        }
        document.body.removeChild(fileInput);
      })
      fileInput.click();
    });

    
  }

  loadFSM(file: File) {
    let reader = new FileReader();
    reader.onload = ($event: any) => {
      let rawAutomaton = JSON.parse($event.target.result)
      this.automata = this.parseAutomatonObject(rawAutomaton)
      this.appStateService.project = this.automata;
      this.router.navigateByUrl("/finite", { replaceUrl: true});
    }
    reader.readAsText(file);
  }

  parseAutomatonObject(rawAutomaton: FiniteAutomata): FiniteAutomata {
    let automaton = new FiniteAutomata(rawAutomaton.isDeterministic);
    automaton.metadata = rawAutomaton.metadata;

    rawAutomaton.alphabet.symbols.forEach((symbol) => {
      automaton.alphabet.addSymbol(symbol);
    })

    rawAutomaton.states.forEach((rawState) => {
      let newState = automaton.createState(rawState.layoutPosition);
      newState.id = rawState.id;
      newState.name = rawState.name;
      newState.type = rawState.type;
    });

    rawAutomaton.states.forEach((rawState, i) => {
      rawState.transitions.forEach((rawTransition, j) => {
        let destinationState = automaton.states.find((state) => {
          return state.id == (rawTransition.destination as any);
        }); 
        
        let newTransition = automaton.states[i].addTransition(destinationState);

        newTransition.shouldDuplicateLayout = rawTransition.shouldDuplicateLayout;

        rawTransition.conditions.forEach((condition) => {
          newTransition.addCondition(condition);
        });
      });
    });
    
    automaton.stateAutoIncrement = rawAutomaton.stateAutoIncrement;

    return automaton;
  }

  newFSM() {
    this.protectAgainstUnsavedChanges(() => {      
      this.automata = new FiniteAutomata(true);
      this.appStateService.project = this.automata;
      this.automata.metadata = new Metadata("New Finite State Automaton");
      this.router.navigateByUrl("/finite/options", { replaceUrl: true }); 
    });
  }

  saveFSM() {
    this.automata.metadata.isUnsaved = false;

    let element = document.createElement('a'),
      jsonAutomaton = JSON.stringify(this.automata, (key, value) => {
      if(key == 'origin' || key == 'destination') {
        return value.id;
      } else if(["selectedState", "selectedTransition", "activeElement"].includes(key)) {
        return undefined;
      } else {
        return value;
      }
    }, 2);
      
    let blob = new Blob([jsonAutomaton], { type: "text/plain"});

    element.setAttribute('href', window.URL.createObjectURL(blob));
    element.setAttribute('download', this.automata.metadata.title + ".fsm.json");  
    element.style.display = 'none';
    document.body.appendChild(element);  
    element.click();  
    document.body.removeChild(element);
  }

  protectAgainstUnsavedChanges(acknowledgeFunction: Function) {
    if(typeof this.automata !== "undefined" && this.automata.metadata.isUnsaved) {
      let message = "Warning: You have unsaved changes in your automaton. If you continue all changes will be lost.";
      alertify.okBtn("Continue without saving").confirm(message, () => {
          acknowledgeFunction();
      });
    } else {
      acknowledgeFunction();
    }
  }
}
